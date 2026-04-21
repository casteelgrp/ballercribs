import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * Renders a listing description authored in markdown. Deliberately narrow:
 *
 * - Raw HTML is disabled (skipHtml) so user-authored <script>, <iframe>, etc.
 *   can never reach the DOM — removes the whole XSS surface without needing
 *   a sanitizer.
 * - Images are blocked; the gallery is the only image surface on a listing.
 * - Code blocks are blocked; not relevant to real estate copy.
 * - remark-breaks converts single `\n` into `<br/>`, preserving the
 *   emoji-bullet-per-line style the existing descriptions use (before this
 *   component, the page relied on CSS `whitespace-pre-line` for that).
 *
 * Headings inherit the site's editorial display font so markdown-authored
 * section titles match the typography of other h2/h3s on the page. Links
 * auto-classify external vs internal — external opens in a new tab with
 * rel=noopener for safety.
 */

const COMPONENTS: Components = {
  h2: ({ children }) => (
    <h2 className="font-display text-2xl sm:text-3xl mt-8 mb-3 leading-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-xl sm:text-2xl mt-6 mb-2 leading-tight">{children}</h3>
  ),
  h1: ({ children }) => (
    // Listing title is already the page h1 above the description. If someone
    // writes `# X` in the body we downgrade to h2 so we don't emit multiple
    // h1s on a single page.
    <h2 className="font-display text-2xl sm:text-3xl mt-8 mb-3 leading-tight">{children}</h2>
  ),
  p: ({ children }) => (
    <p className="text-black/80 leading-relaxed mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-4 space-y-1 text-black/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-4 space-y-1 text-black/80">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => {
    const isExternal =
      typeof href === "string" && !href.startsWith("/") && !href.startsWith("#");
    return (
      <a
        href={href}
        className="text-accent underline underline-offset-2 hover:text-ink transition-colors"
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  }
};

export function ListingDescription({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      skipHtml
      disallowedElements={["img", "pre", "code"]}
      unwrapDisallowed
      components={COMPONENTS}
    >
      {markdown}
    </ReactMarkdown>
  );
}
