import Link from "next/link";
import type { Destination } from "@/lib/types";

/**
 * Horizontal chip row that surfaces a "Browse by destination" jump
 * pad above the /listings and /rentals grids. Each chip points at
 * `/destinations/[slug]`. Pages pass an already-filtered list — the
 * component is purely presentational, doesn't know about counts.
 *
 * Hide-when-sparse rule: fewer than 3 chips renders nothing. Avoids
 * a lonely "Malibu" chip on day one when only one destination has
 * inventory — the row only earns its visual weight once there's
 * enough variety to warrant it.
 *
 * Layout: mobile horizontal scroll without wrap (no-wrap reads as a
 * "rail" rather than a fragmented half-row); sm+ wraps to multiple
 * lines so desktop never has a horizontal scrollbar in the page
 * flow.
 */
const MIN_CHIPS = 3;

export function DestinationChips({
  destinations
}: {
  /** Pre-filtered + alphabetically-ordered destinations. */
  destinations: Destination[];
}) {
  if (destinations.length < MIN_CHIPS) return null;

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-widest text-black/50 mb-2">
        Browse by destination
      </p>
      <div className="flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-x-visible -mx-4 sm:mx-0 px-4 sm:px-0 pb-1 sm:pb-0">
        {destinations.map((d) => (
          <Link
            key={d.id}
            href={`/destinations/${d.slug}`}
            className="text-xs uppercase tracking-widest px-3 py-1.5 border bg-white text-black/60 border-black/20 hover:border-black/40 hover:text-ink transition-colors whitespace-nowrap"
          >
            {d.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
