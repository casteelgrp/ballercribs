import { revalidatePath } from "next/cache";

/**
 * Invalidate every public surface that reflects listing data. Called after
 * any admin write that can change what the public sees — create, update,
 * status transition, sold/unsold, unpublish, delete.
 *
 * Why this exists: the homepage ("/") and detail page ("/listings/[slug]")
 * both run under `export const revalidate = 60`, so without an explicit
 * invalidation call an admin edit could linger on the cached HTML for up
 * to a minute. `/listings` is dynamic today and doesn't strictly need the
 * call, but including it future-proofs against the grid ever going ISR.
 *
 * `slug` is optional — pass it when you have a specific listing in hand so
 * we can target the slug page directly. Omitting it (e.g. DELETE after
 * the row is gone, or a bulk change) still invalidates "/" and "/listings"
 * which covers grid / featured surfaces.
 */
export function revalidateListingSurfaces(slug?: string | null) {
  try {
    revalidatePath("/");
    revalidatePath("/listings");
    if (slug) {
      revalidatePath(`/listings/${slug}`);
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
