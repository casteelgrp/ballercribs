import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingBySlug } from "@/lib/db";
import { formatPrice, formatSqft } from "@/lib/format";
import { InquireForm } from "@/components/InquireForm";
import {
  ListingGalleryGrid,
  ListingHeroImage,
  ListingMediaProvider
} from "@/components/ListingMedia";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug).catch(() => null);
  if (!listing) return { title: "Listing not found — Baller Cribs" };
  const ogImage = listing.social_cover_url ?? listing.hero_image_url;
  return {
    title: `${listing.title} — Baller Cribs`,
    description: listing.description.slice(0, 160),
    openGraph: {
      title: listing.title,
      description: listing.description.slice(0, 160),
      images: [ogImage]
    }
  };
}

export default async function ListingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug).catch(() => null);
  if (!listing) notFound();

  const galleryItems = listing.gallery_image_urls;

  return (
    <ListingMediaProvider
      heroUrl={listing.hero_image_url}
      altBase={listing.title}
      gallery={galleryItems}
    >
      <article>
        {/* Hero image — clickable, opens lightbox at slide 0 */}
        <ListingHeroImage src={listing.hero_image_url} alt={listing.title} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Link
              href="/listings"
              className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
            >
              ← All listings
            </Link>
            <h1 className="font-display text-3xl sm:text-5xl mt-4 leading-tight">
              {listing.title}
            </h1>
            <p className="text-black/60 mt-2 text-lg">{listing.location}</p>

            <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-y border-black/10 py-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-black/50">Price</p>
                <p className="font-display text-2xl text-accent mt-1">
                  {formatPrice(listing.price_usd)}
                </p>
              </div>
              {listing.bedrooms !== null && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-black/50">Bedrooms</p>
                  <p className="font-display text-2xl mt-1">{listing.bedrooms}</p>
                </div>
              )}
              {listing.bathrooms !== null && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-black/50">Bathrooms</p>
                  <p className="font-display text-2xl mt-1">{listing.bathrooms}</p>
                </div>
              )}
              {listing.square_feet !== null && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-black/50">Size</p>
                  <p className="font-display text-2xl mt-1">{formatSqft(listing.square_feet)}</p>
                </div>
              )}
            </div>

            <div className="prose prose-lg mt-8 max-w-none">
              {listing.description.split("\n\n").map((para, i) => (
                <p key={i} className="text-black/80 leading-relaxed mb-4">
                  {para}
                </p>
              ))}
            </div>

            {/* Gallery — clickable thumbnails open the lightbox at the matching slide */}
            {galleryItems.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xs uppercase tracking-widest text-black/50 mb-4">Gallery</h2>
                <ListingGalleryGrid gallery={galleryItems} altBase={listing.title} />
              </div>
            )}

            {listing.agent_name && (
              <div className="mt-12 border-t border-black/10 pt-6">
                <p className="text-xs uppercase tracking-widest text-black/50">Listed by</p>
                <p className="mt-2 font-medium">{listing.agent_name}</p>
                {listing.agent_brokerage && (
                  <p className="text-sm text-black/60">{listing.agent_brokerage}</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - inquire form */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 border border-black/10 bg-white p-6">
              <h2 className="font-display text-2xl">Interested?</h2>
              <p className="text-sm text-black/60 mt-1 mb-6">
                Get connected directly with the listing agent.
              </p>
              <InquireForm listingId={listing.id} listingTitle={listing.title} />
            </div>
          </aside>
        </div>
      </article>
    </ListingMediaProvider>
  );
}
