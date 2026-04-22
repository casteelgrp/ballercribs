import { revalidatePath } from "next/cache";
import type { ListingType } from "./types";

/**
 * Invalidate every public surface that reflects listing data. Called after
 * any admin write that can change what the public sees — create, update,
 * status transition, sold/unsold, unpublish, delete.
 *
 * Why this exists: the homepage ("/") and detail pages (both sale and
 * rental) all run under `export const revalidate = 60`, so without an
 * explicit invalidation call an admin edit could linger on the cached
 * HTML for up to a minute. Index pages (/listings, /rentals) are
 * dynamic but invalidating them is a harmless no-op that future-proofs
 * against either going ISR.
 *
 * `slug` is optional — pass it when you have a specific listing in hand
 * so we can target the slug page directly. `listingType` defaults to
 * 'sale' to preserve the original single-type contract of callers that
 * don't pass one.
 */
export function revalidateListingSurfaces(
  slug?: string | null,
  listingType: ListingType = "sale"
) {
  try {
    revalidatePath("/");
    if (listingType === "rental") {
      revalidatePath("/rentals");
      if (slug) revalidatePath(`/rentals/${slug}`);
    } else {
      revalidatePath("/listings");
      if (slug) revalidatePath(`/listings/${slug}`);
    }
    // Sitemap + opengraph images are built from the same data — Next
    // auto-invalidates them when the page paths above are invalidated,
    // no separate call needed.
  } catch (err) {
    // revalidatePath throws if called outside a server action / route
    // handler context. We only ever call it from route handlers, but
    // catch to keep the primary write path resilient to any framework
    // quirk during a deploy.
    console.warn("[revalidate-listings] revalidatePath threw:", err);
  }
}
