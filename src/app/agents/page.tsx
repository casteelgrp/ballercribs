import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AgentInquiryForm } from "@/components/AgentInquiryForm";
import { FeatureTile } from "@/components/FeatureTile";
import { HeroMosaic } from "@/components/HeroMosaic";
import { getActiveHeroPhotos } from "@/lib/db";

export const metadata: Metadata = {
  title: "For Agents — Feature your luxury listings",
  description:
    "10.5M views across 4.4M accounts in 90 days. Feature your luxury listings to an engaged audience of high-net-worth buyers and sellers. Agent referral network available nationwide.",
  openGraph: {
    type: "website",
    url: "/agents",
    title: "For Agents — Feature your luxury listings on BallerCribs",
    description:
      "10.5M views in 90 days across 4.4M accounts. The audience your listing deserves."
  },
  twitter: {
    card: "summary_large_image",
    title: "For Agents — Feature your luxury listings on BallerCribs",
    description:
      "10.5M views in 90 days across 4.4M accounts. The audience your listing deserves."
  },
  alternates: {
    canonical: "/agents"
  }
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How long does it take to go live?",
    a: "Typically 3-5 business days from content approval to publication."
  },
  {
    q: "Who writes the copy?",
    a: "We do. Our team knows what performs on our channels. You review before we publish."
  },
  {
    q: "Can I see post performance?",
    a: "Yes. We share post-publication metrics (views, engagement, inquiry volume) within 7 days."
  },
  {
    q: "What if my listing doesn't sell?",
    a: "We promote to qualified buyers, but can't guarantee a sale. What we guarantee is distribution to our audience."
  },
  {
    q: "Do you work with listings outside the US?",
    a: "Yes. We feature listings globally — London, Dubai, Monaco, the Caribbean, anywhere."
  },
  {
    q: "What if I want to work together long-term?",
    a: "We love that. Reach out about our retainer packages."
  }
];

export default async function AgentsPage() {
  // Reuse hero_photos from the homepage carousel — no separate admin surface.
  // 3+ active photos unlocks the mosaic; fewer falls back to the text-only hero.
  const heroPhotos = await getActiveHeroPhotos().catch(() => []);
  const hasMosaic = heroPhotos.length >= 3;

  return (
    <>
      {/* ─── 1. Hero ────────────────────────────────────────────────── */}
      <section className="bg-ink text-paper">
        <div
          className={
            hasMosaic
              ? "max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28"
              : "max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28"
          }
        >
          <div
            className={
              hasMosaic
                ? "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 lg:gap-16 items-center"
                : ""
            }
          >
            <div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
                Put your listing in front of{" "}
                <span className="text-accent">millions.</span>
              </h1>
              <p className="mt-6 text-lg text-paper/80 max-w-2xl">
                Seen by millions every month across Instagram, Facebook, and TikTok.
                Verified carousel performance, real buyer inquiries.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <StatPill label="Views in 90 days" value="10.5M" />
                <StatPill label="Accounts reached" value="4.4M" />
                <StatPill label="Reach to non-followers" value="82.8%" />
                <StatPill label="Instagram followers" value="234K" />
              </div>

              <a
                href="#inquire"
                className="inline-block mt-10 bg-accent text-ink px-8 py-3 text-sm uppercase tracking-widest hover:bg-paper transition-colors"
              >
                Get featured →
              </a>
            </div>

            {hasMosaic && (
              <div>
                <HeroMosaic photos={heroPhotos} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── 2. How it works ────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="font-display text-3xl sm:text-4xl text-center">
          How featured listings work.
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-10">
          <Step
            num="1"
            title="You send us the listing"
            body="Send photos, pricing, details, and what makes the property special. We curate before publishing."
          />
          <Step
            num="2"
            title="We publish across all platforms"
            body="One carousel post on Instagram. One Reel. A dedicated listing page on ballercribs.com. Simultaneously posted to Facebook and TikTok."
          />
          <Step
            num="3"
            title="Qualified buyers inquire"
            body="Interested buyers fill out our inquiry form (pre-approval status, timeline, specifics). Leads route directly to you."
          />
        </div>
      </section>

      {/* ─── 3. Recent features ─────────────────────────────────────── */}
      {/* Proof sits above pricing — numbers earn the price, not the other way
          around. Six tiles: two top performers (1M+) and four typical features
          to set honest expectations. */}
      <section className="bg-black/[0.02] border-y border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="font-display text-3xl sm:text-4xl text-center">
            Recent features that moved.
          </h2>
          <p className="mt-4 text-center text-black/70 max-w-2xl mx-auto">
            Average feature: 100K+ views, 1K+ shares, and direct buyer inquiries.
            Top features cross 1M views.
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureTile
              label="Top performer"
              photoSrc="/feature-wahlberg-hero.jpg"
              statsSrc="/feature-wahlberg-stats.jpg"
              caption="Mark Wahlberg's $37M Florida mansion"
              stats="1.37M views · 53K likes · 16K shares · 272 days of watch time"
            />
            <FeatureTile
              label="Top performer"
              photoSrc="/feature-arizona-hero.jpg"
              statsSrc="/feature-arizona-stats.jpg"
              caption="Arizona estate with everything"
              stats="1.22M views · 83K interactions · 27.6K shares · 5.9K saves"
            />
            <FeatureTile
              label="Featured"
              photoSrc="/feature-washington-dc-hero.jpg"
              statsSrc="/feature-washington-dc-stats.jpg"
              caption="Washington DC mansion with movie theater & elevator"
              stats="188.8K views · 7K likes · 2.5K shares · 1.3K saves"
            />
            <FeatureTile
              label="Featured"
              photoSrc="/feature-chattanooga-hero.jpg"
              statsSrc="/feature-chattanooga-stats.jpg"
              caption="Chattanooga retreat above the Tennessee River Gorge"
              stats="150.3K views · 4.2K likes · 2.4K shares · 852 saves"
            />
            <FeatureTile
              label="Featured"
              photoSrc="/feature-diamond-bar-hero.jpg"
              statsSrc="/feature-diamond-bar-stats.jpg"
              caption="Unique icon in Diamond Bar, California"
              stats="117K views · 2.5K likes · 3.5K shares · 563 saves"
            />
            <FeatureTile
              label="Featured"
              photoSrc="/feature-long-island-hero.jpg"
              statsSrc="/feature-long-island-stats.jpg"
              caption="Long Island estate in prestigious enclave"
              stats="94.8K views · 2.3K likes · 1.1K shares · 529 saves"
            />
          </div>
        </div>
      </section>

      {/* ─── 4. What's included ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl">What you get.</h2>
          <ul className="mt-8 space-y-3 text-black/80">
            {[
              "Professional carousel post on Instagram (9-10 slides, custom copy)",
              "Instagram Reel with original edit",
              "Dedicated listing page with photo gallery and inquiry form on ballercribs.com",
              "Cross-posts to Facebook and TikTok",
              "Email mention in BallerCribs Weekly newsletter (when applicable)",
              "All buyer inquiries routed directly to you"
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="text-accent flex-shrink-0 mt-0.5">✦</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-3xl sm:text-4xl">What it costs.</h2>
          <div className="mt-8 space-y-4">
            <PriceCard
              title="Single Feature"
              price="Starting at $1,500"
              body="One property, fully promoted across all channels."
            />
            <PriceCard
              title="Package of 3"
              price="Starting at $3,750"
              body="Three featured listings over 30 days. Save $750."
            />
            <PriceCard
              title="Exclusive Takeover"
              price="Starting at $5,000"
              body="Dominate our feed for a week. Multiple posts, Reels, and priority newsletter placement."
            />
            <p className="text-sm italic text-black/60 pt-2">
              Custom pricing available for portfolios, luxury brokerages, and multi-property
              campaigns.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 5. Referral partner program ────────────────────────────── */}
      <section className="bg-black/[0.02] border-y border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="font-display text-3xl sm:text-4xl max-w-3xl">
            We've got the buyer. You close the deal.
          </h2>
          <p className="mt-6 text-black/70 max-w-3xl leading-relaxed">
            Not every property is right for a paid feature — but qualified buyers still come through
            our inbox every week. When one inquires about a home in your market, we route them to a
            partner agent and share in the commission. You do what you already do best. We bring the
            lead.
          </p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <ReferralSpec
              title="25-35% referral fee"
              body="Standard rate at close. Negotiable on luxury transactions."
            />
            <ReferralSpec
              title="Licensed referral network, cooperative nationwide"
              body="Broker-to-broker agreements let us refer buyers in any market."
            />
            <ReferralSpec
              title="Pre-qualified leads only"
              body="Every buyer completes a full inquiry form — timeline, budget, and financing before it hits your inbox."
            />
          </div>

          <Link
            href="/agents?type=referral#inquire"
            className="inline-block mt-10 border border-ink text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
          >
            Become a partner agent →
          </Link>
        </div>
      </section>

      {/* ─── 6. Testimonials ────────────────────────────────────────── */}
      {/* TODO: Add testimonials when we have them. */}

      {/* ─── 7. FAQ ─────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="font-display text-3xl sm:text-4xl text-center">Frequently asked.</h2>
        <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-base font-medium">
                <span>{q}</span>
                <span
                  aria-hidden="true"
                  className="text-2xl leading-none text-black/40 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-black/70 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── 8. Inquiry form ────────────────────────────────────────── */}
      <section id="inquire" className="bg-ink text-paper scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
          <div className="max-w-xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl text-center">
              Let's get your listing seen.
            </h2>
            <p className="mt-4 text-paper/80 text-center">
              Tell us about your property or referral interest. We'll respond within 24 hours.
            </p>
            <div className="mt-10">
              {/* useSearchParams requires a Suspense boundary during SSG prerender. */}
              <Suspense fallback={null}>
                <AgentInquiryForm />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Subcomponents (server; plain presentation) ────────────────────────────

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex flex-col items-start border border-paper/20 px-5 py-3 min-w-[140px]">
      <span className="font-display text-2xl sm:text-3xl leading-none">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-paper/60">{label}</span>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-display text-5xl text-accent leading-none">{num}</p>
      <h3 className="font-display text-2xl mt-4">{title}</h3>
      <p className="mt-3 text-black/70 leading-relaxed">{body}</p>
    </div>
  );
}

function PriceCard({ title, price, body }: { title: string; price: string; body: string }) {
  return (
    <div className="border border-black/10 bg-white p-6">
      <p className="text-xs uppercase tracking-widest text-black/50">{title}</p>
      <p className="font-display text-2xl text-accent mt-2">{price}</p>
      <p className="mt-3 text-sm text-black/70">{body}</p>
    </div>
  );
}

function ReferralSpec({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-black/70 leading-relaxed">{body}</p>
    </div>
  );
}
