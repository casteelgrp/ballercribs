import DOMPurify from "isomorphic-dompurify";

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
    "figure", "figcaption"
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "src", "alt", "title", "loading",
    "class", "data-property-card",
    // Gallery attrs (D4): data-gallery on the container, data-count
    // + data-images on the same container (data-images is the
    // round-trip JSON blob the extension emits for reliable parseHTML).
    "data-gallery", "data-count", "data-images"
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|\/|mailto:|tel:|#)/i
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
  return DOMPurify.sanitize(input, CONFIG);
}
