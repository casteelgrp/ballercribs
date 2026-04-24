import DOMPurify from "isomorphic-dompurify";
import { isAllowedEmbedSrc } from "./video-url";

/**
 * Shared body_html sanitizer. body_html comes from the TipTap editor via
 * editor.getHTML() and lands on both the POST (create) and PATCH (update)
 * routes. Our own editor is the authored source, but we sanitize anyway —
 * cheap XSS insurance against a future path that accepts HTML from
 * elsewhere, or a compromised author session.
 *
 * Kept in a single module so allowlist extensions for new block types
 * (gallery, video embed, etc.) land once and both write paths pick them
 * up. Previously this config was duplicated verbatim across two route
 * files — extract was a pre-D4 cleanup.
 *
 * Allowlist shape:
 *   - Tags: StarterKit (paragraphs, headings, lists, inline formatting,
 *     blockquote, code, hr) + Link (a) + Image (img) + PropertyCard
 *     renderHTML output (div + span)
 *   - Attrs: the minimum set the extensions emit (href/target/rel for
 *     links, src/alt/title/loading for images, class + data-property-card
 *     for the card markup)
 *   - URI scheme: http(s) + relative + mailto + tel + fragment.
 */
const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "code", "pre",
    "blockquote", "h1", "h2", "h3", "h4", "ul", "ol", "li",
    "hr", "a", "img", "div", "span",
    // Gallery block markup (D4): figure + figcaption wrap each item,
    // the outer container is a <div data-gallery>.
    "figure", "figcaption",
    // Video embed block (D4): <div data-video-embed><iframe …></div>.
    // Iframe src is additionally validated by a hook (below) — only
    // youtube-nocookie and player.vimeo URLs survive.
    "iframe"
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "src", "alt", "title", "loading",
    "class", "data-property-card",
    // Gallery attrs (D4): data-gallery on the container, data-count
    // + data-images on the same container (data-images is the
    // round-trip JSON blob the extension emits for reliable parseHTML).
    "data-gallery", "data-count", "data-images",
    // Video-embed attrs (D4): provider + id on the wrapper for the
    // extension's parseHTML round-trip; iframe standard attrs for the
    // actual embed. referrerpolicy / sandbox deliberately NOT included.
    "data-video-embed", "data-provider", "data-video-id",
    "width", "height", "frameborder", "allow", "allowfullscreen"
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|\/|mailto:|tel:|#)/i
};

// Strict iframe-src allowlist. The ALLOWED_URI_REGEXP above applies
// to every URI attr (href, img src, iframe src) uniformly — it can't
// tell the difference between "a link to example.com" (fine) and "an
// iframe loading example.com" (not fine). We install a DOMPurify hook
// that strips any iframe whose src doesn't match the two privacy-
// enhanced providers we emit. Module-level guard keeps the hook
// registered exactly once across hot reloads.
let iframeHookInstalled = false;
function ensureIframeHook() {
  if (iframeHookInstalled) return;
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName !== "iframe") return;
    const src = (node as Element).getAttribute?.("src") ?? "";
    if (!isAllowedEmbedSrc(src)) {
      // Remove the offending iframe entirely — an iframe with its src
      // cleared would still render a frame, and we'd rather lose the
      // block than leave an empty one.
      (node as Element).parentNode?.removeChild(node as Element);
    }
  });
  iframeHookInstalled = true;
}
ensureIframeHook();

/**
 * Sanitize body_html from an arbitrary caller input.
 *
 * Return semantics intentionally cover both create and update flows:
 *   - `undefined` input / non-string → `undefined` (update path treats as "skip this field")
 *   - empty string → `""` (update path treats as "clear this field")
 *   - non-empty string → sanitized HTML
 *
 * Create callers coerce undefined → null at the destructuring site
 * (`sanitizeBlogHtml(x) ?? null`) since "skip" has no meaning on insert.
 */
export function sanitizeBlogHtml(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  if (input === "") return "";
  return DOMPurify.sanitize(input, CONFIG);
}
