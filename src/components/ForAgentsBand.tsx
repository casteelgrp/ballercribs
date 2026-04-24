import Image from "next/image";
import Link from "next/link";

/**
 * Full-bleed dark marketing CTA for agents. Previously lived inline on
 * the homepage; moved to /listings bottom in D6 on the theory that
 * homepage skews buyer/casual while /listings visitors scrolling the
 * catalog include agents evaluating fit. Extracted so the band can be
 * dropped into any future surface without a second copy/paste.
 *
 * Wraps itself in a full-bleed <section> — callers should render it
 * OUTSIDE any max-w content container so the ink stretches edge-to-
 * edge. Rendering inside a narrow column degrades the band to a
 * cramped strip.
 */
export function ForAgentsBand() {
  return (
    <section className="bg-ink text-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Image
          src="/logo-white.png"
          alt="BallerCribs"
          width={400}
          height={80}
          className="h-20 w-auto mx-auto mb-6"
        />
        <p className="text-xs uppercase tracking-widest text-accent">For agents</p>
        <h2 className="font-display text-3xl sm:text-4xl mt-3">
          Put your listing in front of millions.
        </h2>
        <p className="mt-4 text-paper/70 max-w-2xl mx-auto">
          Seen by millions every month across Instagram, Facebook, and TikTok. Featured
          placements include a carousel post, a Reel, a dedicated listing page, and direct buyer
          inquiries.
        </p>
        <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
          <Link
            href="/agents"
            className="inline-block bg-accent text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-paper transition-colors"
          >
            Get featured
          </Link>
          <a
            href="mailto:theballercribs@gmail.com?subject=Featured%20listing%20inquiry"
            className="text-sm text-paper/70 hover:text-paper underline underline-offset-4"
          >
            Or email us directly
          </a>
        </div>
      </div>
    </section>
  );
}
