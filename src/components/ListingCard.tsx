import Link from "next/link";
import Image from "next/image";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/format";

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
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg leading-tight truncate">{listing.title}</h3>
          <span className="font-medium text-accent shrink-0">
            {isSold
              ? listing.sold_price_usd !== null
                ? `Sold · ${formatPrice(listing.sold_price_usd)}`
                : "Sold"
              : formatPrice(listing.price_usd)}
          </span>
        </div>
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
