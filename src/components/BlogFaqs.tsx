import { Fragment } from "react";
import type { BlogFaq } from "@/types/blog";

/**
 * Static "Frequently Asked Questions" section. Renders nothing when
 * the post has no FAQs so the same JSX can sit unconditionally on
 * the post detail page without an outer guard.
 *
 * No accordion / no expand-collapse on purpose — keeps every Q+A
 * visible to crawlers + readers and matches Google's preference for
 * static FAQPage markup (collapsible content that hides answers from
 * the initial paint risks not being eligible for the rich result).
 *
 * Wrapped in .blog-prose so the existing typography rules from
 * globals.css (h2/h3 sizes, body color, spacing) apply natively —
 * the section reads as a continuation of the post body, not a
 * different design system stitched on at the bottom.
 */
export function BlogFaqs({ faqs }: { faqs: BlogFaq[] | null | undefined }) {
  if (!faqs || faqs.length === 0) return null;

  // h3 + p emitted directly (no per-FAQ wrapper div) so the existing
  // .blog-prose h3 / p margin rules in globals.css drive the rhythm
  // uniformly. A wrapper div would create new block formatting
  // contexts that block margin collapse and force ad-hoc spacing
  // utilities — easier to lean on the prose rules already shipping.
  return (
    <section
      aria-labelledby="blog-faqs-heading"
      className="blog-faqs blog-prose mt-12 border-t border-black/10 pt-12"
    >
      <h2 id="blog-faqs-heading">Frequently Asked Questions</h2>
      {faqs.map((faq, i) => (
        <Fragment key={i}>
          <h3>{faq.question}</h3>
          <p>{faq.answer}</p>
        </Fragment>
      ))}
    </section>
  );
}
