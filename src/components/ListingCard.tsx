import Link from "next/link";
import Image from "next/image";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/currency";

const UNIT_LABEL: Record<"night" | "week" | "month", string> = {
  night: "night",
  week: "week",
  month: "month"
};

const TERM_LABEL: Record<"short_term" | "long_term", string> = {
  short_term: "Short-term",
  long_term: "Long-term"
};

function renderCardPrice(listing: Listing): string {
  if (listing.listing_type === "rental") {
    if (listing.rental_price_cents === null || listing.rental_price_unit === null) {
      return "Rental — price on request";
    }
    const whole = Math.round(listing.rental_price_cents / 100);
    return `from ${formatPrice(whole, listing.currency)}/${UNIT_LABEL[listing.rental_price_unit]}`;
  }
  const isSold = !!listing.sold_at;
  if (isSold) {
    return listing.sold_price_usd !== null
      ? `Sold · ${formatPrice(listing.sold_price_usd, listing.currency)}`
      : "Sold";
  }
  return formatPrice(listing.price_usd, listing.currency);
}

export function ListingCard({ listing }: { listing: Listing }) {
  const isRental = listing.listing_type === "rental";
  const isSold = !isRental && !!listing.sold_at;
  // Rentals land on /rentals/[slug]; sale inventory stays on
  // /listings/[slug]. Card picks the correct route automatically so
  // /rentals grid and /listings grid can share the same component.
  const href = isRental ? `/rentals/${listing.slug}` : `/listings/${listing.slug}`;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
        <Image
          src={listing.hero_image_url}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={
            "object-cover transition-transform duration-700 group-hover:scale-105 " +
            (isSold ? "opacity-90" : "")
          }
        />
        {listing.featured && !isSold && (
          <span className="absolute top-3 left-3 bg-ink text-paper text-[10px] uppercase tracking-widest px-2 py-1">
            Featured
          </span>
        )}
        {isSold && (
          <span className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 shadow-sm">
            Sold
          </span>
        )}
      </div>
      <div className="mt-3">
        {/* Title takes its natural height — 1 line for short titles, up to
            2 lines for long ones (line-clamp-2 caps it). Reserving a fixed
            2-line height made short titles hang over an empty gap; the
            image row in the CSS grid already keeps cards visually aligned. */}
        <h3 className="font-display text-lg leading-tight line-clamp-2">
          {listing.title}
        </h3>
        {isRental && listing.rental_term && (
          <p className="text-[10px] uppercase tracking-widest text-black/45 mt-1">
            {TERM_LABEL[listing.rental_term]}
          </p>
        )}
        <p className="font-medium text-accent mt-1">{renderCardPrice(listing)}</p>
        <p className="text-sm text-black/60 mt-1">{listing.location}</p>
        {(listing.bedrooms || listing.bathrooms || listing.square_feet) && (
          <p className="text-xs text-black/50 mt-1">
            {listing.bedrooms ? `${listing.bedrooms} bd` : ""}
            {listing.bedrooms && listing.bathrooms ? " · " : ""}
            {listing.bathrooms ? `${listing.bathrooms} ba` : ""}
            {(listing.bedrooms || listing.bathrooms) && listing.square_feet ? " · " : ""}
            {listing.square_feet ? `${listing.square_feet.toLocaleString()} sq ft` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
