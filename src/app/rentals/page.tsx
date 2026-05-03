import type { Metadata } from "next";
import Link from "next/link";
import {
  getListingBySlug,
  getPublicDestinationCountsMap,
  getPublishedDestinations,
  getRentalListings
} from "@/lib/db";
import { getRentalHeroImages } from "@/lib/rentals";
import { HeroMosaic } from "@/components/HeroMosaic";
import { ListingCard } from "@/components/ListingCard";
import { RentalInquiryForm } from "@/components/RentalInquiryForm";
import { DestinationChips } from "@/components/DestinationChips";

export const revalidate = 60;

const META_DESCRIPTION =
  "Luxury villas and private estates worldwide — handpicked for vacations, private events, and group getaways. Weekly stays, French Riviera to the Hamptons.";

export const metadata: Metadata = {
  title: "Luxury Villas & Private Estates",
  description: META_DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/rentals",
    title: "Luxury Villas & Private Estates | BallerCribs",
    description: META_DESCRIPTION,
    images: ["/opengraph-image"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Luxury Villas & Private Estates | BallerCribs",
    description: META_DESCRIPTION,
    images: ["/opengraph-image"]
  },
  alternates: {
    canonical: "/rentals"
  }
};

export default async function RentalsPage({
  searchParams
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const sp = await searchParams;
  const propertySlug = typeof sp.property === "string" ? sp.property.trim() : "";

  // Pre-fill data for the inquiry form when the viewer arrives from a
  // rental detail page (/rentals?property=some-slug#inquire). If the slug
  // doesn't resolve, we still accept a graceful degrade — the form renders
  // empty and the listing_id stays null.
  const prefill = propertySlug
    ? await getListingBySlug(propertySlug, "rental").catch(() => null)
    : null;

  const [listings, heroImages, destinations, destinationCounts] = await Promise.all([
    getRentalListings().catch(() => []),
    getRentalHeroImages().catch(() => []),
    getPublishedDestinations().catch(() => []),
    getPublicDestinationCountsMap().catch(
      () => ({}) as Record<number, { listings: number; rentals: number; blog_posts: number }>
    )
  ]);
  const hasMosaic = heroImages.length >= 3;

  // Chip row: only destinations with rental inventory. Component
  // hides itself when fewer than 3 chips would render.
  const chipDestinations = destinations.filter(
    (d) => (destinationCounts[d.id]?.rentals ?? 0) > 0
  );

  return (
    <article>
      {/* Hero — two-column layout on desktop mirroring /agents, collapses
          to a single stack on mobile. Padding is symmetric (py-20 sm:py-28)
          so the headline sits centered in the black frame whether or not
          the mosaic renders. */}
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
                Luxury Villas &amp; Private Estates
              </h1>
              <p className="mt-6 text-lg text-paper/80 max-w-2xl leading-relaxed">
                Weekly stays, event venues, and private getaways — handpicked
                worldwide.
              </p>
            </div>

            {hasMosaic && (
              <div>
                <HeroMosaic photos={heroImages} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Use-case strip — wayfinding, not a sales surface. Three columns
          on desktop, stacked on mobile. Icons sit muted (text-black/55)
          alongside the label so the row reads as orientation rather
          than a feature grid; no CTAs by design. */}
      <section className="border-b border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
            <li className="flex items-start gap-4">
              <PlaneIcon className="w-6 h-6 text-black/55 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-lg leading-tight">Vacation Stays</h3>
                <p className="text-sm text-black/60 mt-1 leading-relaxed">
                  Weeklong escapes for families and friends.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <SparklesIcon className="w-6 h-6 text-black/55 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-lg leading-tight">Private Events</h3>
                <p className="text-sm text-black/60 mt-1 leading-relaxed">
                  Weddings, retreats, and milestone celebrations.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <MountainIcon className="w-6 h-6 text-black/55 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-lg leading-tight">Group Getaways</h3>
                <p className="text-sm text-black/60 mt-1 leading-relaxed">
                  Multi-couple trips and reunion houses.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Listings grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div>
          <p className="text-xs uppercase tracking-widest text-black/50">Featured villas</p>
          <h2 className="font-display text-2xl sm:text-3xl mt-2">Available now</h2>
        </div>

        <DestinationChips destinations={chipDestinations} />

        {listings.length === 0 ? (
          <div className="border border-dashed border-black/15 py-20 text-center text-black/60 mt-6">
            <p>No villas featured yet.</p>
            <p className="text-sm mt-2">
              We&apos;re adding new properties weekly —{" "}
              <Link
                href="/newsletter"
                className="underline underline-offset-2 hover:text-accent transition-colors"
              >
                join the newsletter
              </Link>{" "}
              for new arrivals.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* Inquire form — dark surface, scroll anchor */}
      <section id="inquire" className="bg-ink text-paper scroll-mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-widest text-accent">
              Tell us what you need
            </p>
            <h2 className="font-display text-3xl sm:text-4xl mt-3 leading-tight">
              {prefill
                ? `Inquire about ${prefill.title}`
                : "Request a rental — we'll match you with the right home."}
            </h2>
            {prefill && (
              <p className="mt-3 text-paper/60 text-sm">{prefill.location}</p>
            )}
          </div>
          <RentalInquiryForm
            destinationInitial={prefill?.title ?? prefill?.location ?? ""}
            listingId={prefill?.id ?? null}
            listingSlug={prefill?.slug ?? null}
          />
        </div>
      </section>

      {/* How booking works — three-step explainer that replaces the
          earlier "What happens next" prose. Positions BallerCribs as
          partner-curation rather than direct booking, which is the
          most common visitor misconception. Single source of truth
          for the partner flow; the inquiry-form sidebar copy on
          detail pages ladders into "the right booking partner". */}
      <section className="border-t border-black/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl">How booking works</h2>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
            <li>
              <p className="font-display text-3xl text-accent">01</p>
              <h3 className="font-display text-xl mt-3">Browse</h3>
              <p className="text-sm text-black/65 mt-2 leading-relaxed">
                Every villa is vetted by our team. Curated for design,
                location, and the experience on the ground.
              </p>
            </li>
            <li>
              <p className="font-display text-3xl text-accent">02</p>
              <h3 className="font-display text-xl mt-3">Inquire</h3>
              <p className="text-sm text-black/65 mt-2 leading-relaxed">
                Tell us your dates, group size, and what you&apos;re planning.
                We route you to the right partner.
              </p>
            </li>
            <li>
              <p className="font-display text-3xl text-accent">03</p>
              <h3 className="font-display text-xl mt-3">Book</h3>
              <p className="text-sm text-black/65 mt-2 leading-relaxed">
                Our booking partners handle the contract, payment, and
                concierge. We stay in your corner if anything&apos;s off.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </article>
  );
}

// Inline SVGs over a new icon dependency — three glyphs aren't worth
// pulling in lucide-react. Stroke + viewBox match the SiteHeader /
// SocialLinks pattern so they read consistently against site type.
function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}
