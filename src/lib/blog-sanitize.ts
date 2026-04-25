import sanitizeHtml from "sanitize-html";
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
 * Backed by sanitize-html (htmlparser2) instead of isomorphic-dompurify
 * (jsdom) — D6 swap. The jsdom subtree pulled in @exodus/bytes which
 * shipped an ESM-only encoding-lite that html-encoding-sniffer requires
 * via CJS, crashing every blog write route on module load. sanitize-html
 * has the same allowlist semantics and no jsdom.
 *
 * Allowlist shape (faithful translation of the prior DOMPurify config):
 *   - Tags: StarterKit (paragraphs, headings, lists, inline formatting,
 *     blockquote, code, hr) + Link (a) + Image (img) + PropertyCard
 *     renderHTML output (div + span) + Gallery (figure, figcaption) +
 *     Video embed (iframe, restricted by exclusiveFilter below)
 *   - Attrs: applied to '*' to match DOMPurify's flat ALLOWED_ATTR
 *     behavior (any allowed attr permitted on any allowed tag) — this
 *     is more permissive than sanitize-html's per-tag default, but
 *     matches what was shipping before
 *   - Schemes: http, https, mailto, tel. Relative URLs (/...) and
 *     fragments (#...) pass without a scheme check — sanitize-html's
 *     default. Protocol-relative URLs (//evil.com) are blocked by
 *     allowProtocolRelative: false (also the default).
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "s", "code", "pre",
  "blockquote", "h1", "h2", "h3", "h4", "ul", "ol", "li",
  "hr", "a", "img", "div", "span",
  // Gallery block markup (D4): figure + figcaption wrap each item,
  // the outer container is a <div data-gallery>.
  "figure", "figcaption",
  // Video embed block (D4): <div data-video-embed><iframe …></div>.
  // Iframe src is additionally validated by exclusiveFilter below —
  // only youtube-nocookie and player.vimeo URLs survive.
  "iframe"
];

const ALLOWED_ATTRS = [
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
];

const CONFIG: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { "*": ALLOWED_ATTRS },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // sanitize-html applies allowedSchemes to all URI-bearing attrs by
  // default (href, src, etc.). Relative + fragment URLs pass without
  // matching any scheme — that's the sanitize-html default and matches
  // the prior /^(?:https?:|\/|mailto:|tel:|#)/i regex.
  allowProtocolRelative: false,
  // Strip any iframe whose src isn't from the privacy-enhanced
  // providers the embed extension emits. Replaces the prior DOMPurify
  // uponSanitizeElement hook. Returning true removes the element.
  exclusiveFilter: (frame) => {
    if (frame.tag !== "iframe") return false;
    const src = frame.attribs.src ?? "";
    return !isAllowedEmbedSrc(src);
  }
};

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
  return sanitizeHtml(input, CONFIG);
}
