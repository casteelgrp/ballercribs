import Link from "next/link";
import Image from "next/image";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/currency";

export function ListingCard({ listing }: { listing: Listing }) {
  const isSold = !!listing.sold_at;

  return (
    <Link href={`/listings/${listing.slug}`} className="group block">
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
        {/* Title reserves 2 lines of height regardless of actual length so
            grid rows stay baseline-aligned at the price / location / specs
            lines. Long titles clamp to 2 lines with an ellipsis; short
            titles render on 1 line but still occupy the 2-line block. */}
        <h3 className="font-display text-lg leading-tight line-clamp-2 min-h-[2lh]">
          {listing.title}
        </h3>
        <p className="font-medium text-accent mt-1">
          {isSold
            ? listing.sold_price_usd !== null
              ? `Sold · ${formatPrice(listing.sold_price_usd, listing.currency)}`
              : "Sold"
            : formatPrice(listing.price_usd, listing.currency)}
        </p>
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
