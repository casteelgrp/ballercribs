import type { Metadata } from "next";
import Link from "next/link";
import {
  countRentalListingsByTerm,
  getListingBySlug,
  getRentalListings,
  type PublicRentalTermFilter
} from "@/lib/db";
import { getRentalHeroImages } from "@/lib/rentals";
import { HeroMosaic } from "@/components/HeroMosaic";
import { ListingCard } from "@/components/ListingCard";
import { RentalInquiryForm } from "@/components/RentalInquiryForm";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Rent a Mega-Mansion",
  description:
    "Short-term and long-term luxury mansion rentals — weddings, family trips, corporate retreats. Browse featured homes or tell us what you need.",
  openGraph: {
    title: "Rent a Mega-Mansion | BallerCribs",
    description:
      "Short-term and long-term luxury rentals — estates, architectural icons, and resort-scale homes. Browse or tell us what you're looking for."
  },
  alternates: {
    canonical: "/rentals"
  }
};

const TERM_FILTER_OPTIONS: { value: PublicRentalTermFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "short_term", label: "Short-term" },
  { value: "long_term", label: "Long-term" }
];

function resolveTermFilter(raw: string | undefined): PublicRentalTermFilter {
  if (raw === "short_term" || raw === "long_term") return raw;
  return "all";
}

export default async function RentalsPage({
  searchParams
}: {
  searchParams: Promise<{ term?: string; property?: string }>;
}) {
  const sp = await searchParams;
  const term = resolveTermFilter(sp.term);
  const propertySlug = typeof sp.property === "string" ? sp.property.trim() : "";

  // Pre-fill data for the inquiry form when the viewer arrives from a
  // rental detail page (/rentals?property=some-slug#inquire). If the slug
  // doesn't resolve, we still accept a graceful degrade — the form renders
  // empty and the listing_id stays null.
  const prefill = propertySlug
    ? await getListingBySlug(propertySlug, "rental").catch(() => null)
    : null;

  const [listings, counts, heroImages] = await Promise.all([
    getRentalListings(term).catch(() => []),
    countRentalListingsByTerm().catch(() => ({ all: 0, short_term: 0, long_term: 0 })),
    getRentalHeroImages().catch(() => [])
  ]);
  const hasMosaic = heroImages.length >= 3;

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
              <p className="text-xs uppercase tracking-widest text-accent">
                BallerCribs Rentals
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight mt-3">
                Rent the crib, not the room.
              </h1>
              <p className="mt-6 text-lg text-paper/80 max-w-2xl leading-relaxed">
                Private estates, architectural icons, and resort-scale homes — by
                the week, month, or season. Browse what we&apos;ve featured below,
                or tell us what you need and we&apos;ll match you with the right
                agent.
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

      {/* Listings grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-6 flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-black/50">Featured rentals</p>
            <h2 className="font-display text-2xl sm:text-3xl mt-2">Available now</h2>
          </div>
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Rental term filter">
            {TERM_FILTER_OPTIONS.map((opt) => {
              const active = opt.value === term;
              const href =
                opt.value === "all" ? "/rentals" : `/rentals?term=${opt.value}`;
              const count = counts[opt.value];
              return (
                <Link
                  key={opt.value}
                  href={href}
                  scroll={false}
                  role="tab"
                  aria-selected={active}
                  className={
                    "text-xs uppercase tracking-widest px-3 py-1.5 border transition-colors " +
                    (active
                      ? "bg-ink text-paper border-ink"
                      : "bg-white text-black/60 border-black/20 hover:border-black/40")
                  }
                >
                  {opt.label} <span className="opacity-60">({count})</span>
                </Link>
              );
            })}
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="border border-dashed border-black/15 py-20 text-center text-black/50">
            <p>No rentals here yet.</p>
            <p className="text-xs mt-2">
              Tell us what you&apos;re looking for below — we&apos;ll find it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
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
            // Listing's rental_term is a perfect default for the radio —
            // user can override, but nine times out of ten they want the
            // same term as the property they clicked through.
            termPreferenceInitial={prefill?.rental_term ?? null}
          />
        </div>
      </section>

      {/* What happens next — keep the editorial beat from the original page */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-black/50">
          What happens next
        </p>
        <h2 className="font-display text-2xl sm:text-3xl mt-3">
          You tell us where. We find the property.
        </h2>
        <p className="mt-4 text-black/70 leading-relaxed max-w-xl mx-auto">
          A member of the BallerCribs team reads every inquiry and connects
          you with a licensed agent or rental specialist in the right market.
          Expect a reply within 48 business hours with options that match your
          budget, headcount, and timing.
        </p>
      </section>
    </article>
  );
}
