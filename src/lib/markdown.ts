/**
 * Plain-text extraction for markdown source. Used anywhere we need a clean
 * string — JSON-LD structured data, OG / Twitter meta descriptions, the
 * truncated search snippet. Google expects plain text in those surfaces, not
 * raw `## Heading` or `**bold**` syntax.
 *
 * Regex-based rather than a real parser because the inputs are short, the
 * syntax subset we support is small (headings / bold / italic / links /
 * lists), and bringing in a full AST round-trip for three-sentence meta
 * descriptions would be overkill. Raw-HTML and images are already blocked
 * at the render layer, so we don't need to handle them here.
 */
export function stripMarkdown(md: string): string {
  return md
    // Images first (include alt text fallback in case they slip through)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Links: keep the anchor text, drop the URL
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Heading markers (##, ###, etc.) at line start
    .replace(/^#{1,6}\s+/gm, "")
    // Bold (** or __)
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    // Italic (* or _) — single marker after bold pass so we don't eat the
    // bold markers' asterisks first. Italic is a single char on each side.
    .replace(/(\*|_)(.+?)\1/g, "$2")
    // List bullets at line start
    .replace(/^[\s]*[-*+]\s+/gm, "")
    // Numbered list markers
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Inline code and fenced code
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Blockquote markers
    .replace(/^>\s*/gm, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}
