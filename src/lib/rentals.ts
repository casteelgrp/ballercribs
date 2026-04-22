import { getActiveHeroPhotos, getRentalListings } from "./db";
import type { HeroPhoto } from "./types";

/**
 * Images for the /rentals hero mosaic. Prefers the hero photos from the
 * most-recently-published rental listings so the page advertises its own
 * inventory, with a fallback to the site-wide hero_photos curation when
 * fewer than 3 rentals exist (pre-launch / thin-catalog case). The mosaic
 * component on /agents expects HeroPhoto-shaped objects, so we adapt
 * listing hero_image_url into that shape to keep the component reusable.
 */
export async function getRentalHeroImages(): Promise<HeroPhoto[]> {
  const rentals = await getRentalListings("all").catch(() => []);

  const rentalPhotos: HeroPhoto[] = rentals
    .filter((l) => Boolean(l.hero_image_url))
    .slice(0, 6)
    .map((l, i) => ({
      // Adapter shape — id is synthetic (HeroPhoto.id is only read as a
      // map key inside HeroMosaic), caption + display_order + active
      // aren't consumed at render time but satisfy the type.
      id: l.id,
      url: l.hero_image_url,
      caption: l.title,
      display_order: i,
      active: true,
      created_at: l.published_at ?? l.created_at
    }));

  if (rentalPhotos.length >= 3) return rentalPhotos;

  // Fallback: site-wide hero_photos. Keeps the hero populated in the
  // pre-launch state where no (or only one or two) rentals exist yet.
  return getActiveHeroPhotos().catch(() => []);
}
