import { SOCIALS } from "@/components/SocialLinks";
import { getSiteUrl } from "@/lib/site";
import type { BlogFaq } from "@/types/blog";

/**
 * Shared JSON-LD helpers. Centralized so the homepage Organization /
 * WebSite block and per-page BreadcrumbList blocks share a single
 * absolute-URL resolver and the same script-escape treatment — no
 * more hand-rolled `<script type="application/ld+json">` copies
 * drifting across detail pages.
 *
 * Existing per-entity blocks (Article, Accommodation, RealEstateListing)
 * still live inline on their detail pages. They pre-date this helper
 * and intentionally haven't been folded in — the JSON-LD audit for D6
 * only asked for additive gap-filling, not a rewrite of the schemas
 * that already validate.
 */

/** Resolve a relative path to an absolute URL. Passes absolute URLs through. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getSiteUrl().replace(/\/$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${base}${rel}`;
}

/**
 * Organization schema for the BallerCribs brand. Emits once on the
 * homepage — Google treats it as the site's publisher identity and
 * applies it to downstream Article / RealEstateListing records.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BallerCribs",
    url: getSiteUrl(),
    logo: absoluteUrl("/logo-black.png"),
    sameAs: SOCIALS.map((s) => s.href)
  };
}

/**
 * WebSite schema with a SearchAction pointing at /search. Lets Google
 * render a site-internal search box in SERPs (sitelinks search). The
 * `query-input` EntryPoint literal is the exact string Google validates
 * against — don't stylize it.
 */
export function websiteSchema(): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BallerCribs",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl.replace(/\/$/, "")}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

/**
 * BreadcrumbList for hierarchical pages. Each item's `url` may be
 * relative ("/listings") or absolute — the helper canonicalizes both.
 * Google accepts the last item referring to itself, so callers include
 * the current page as the final entry for trail completeness.
 */
export function breadcrumbListSchema(
  items: { name: string; url: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url)
    }))
  };
}

/**
 * FAQPage schema for posts with a structured FAQ section. Google uses
 * this for the FAQ rich result in Search — collapsible Q+A entries
 * that expand under the post's SERP listing. Caller should gate emission
 * on `faqs && faqs.length > 0`; the helper itself doesn't.
 */
export function faqPageSchema(faqs: BlogFaq[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };
}

/**
 * Renders `<script type="application/ld+json">` with the supplied
 * schema object. `<` is escaped to `\u003c` so no script tag can
 * survive in a string field and break out of the JSON-LD block —
 * standard defensive move for inline JSON-in-HTML. JSON-LD parsers
 * accept `\u003c` identically to `<`.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
