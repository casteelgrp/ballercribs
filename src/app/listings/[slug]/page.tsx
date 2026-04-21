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
  if (!listing) return { title: "Listing not found" };

  // SEO overrides tailor the Google SERP snippet only. OG / Twitter keep
  // using the listing's natural title + description — social shares are
  // about emotional hook, search titles are about discoverability, they're
  // different optimizations and we don't want one to clobber the other.
  const autoDesc = truncateAtWord(listing.description, 155);
  const searchTitle = listing.seo_title?.trim() || listing.title;
  const searchDesc = listing.seo_description?.trim() || autoDesc;

  return {
    title: searchTitle,
    description: searchDesc,
    openGraph: {
      title: listing.title,
      description: autoDesc,
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description: autoDesc
    },
    alternates: {
      canonical: `/listings/${listing.slug}`
    }
  };
}

function truncateAtWord(raw: string, maxLen: number): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  const slice = oneLine.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  // Only use the word boundary if it's not absurdly far back — otherwise
  // the hard cut is fine.
  const cut = lastSpace > maxLen * 0.6 ? lastSpace : maxLen;
  return oneLine.slice(0, cut).trimEnd() + "…";
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
  const isSold = !!listing.sold_at;

  // JSON-LD schema for search engines. Helps Google produce rich results
  // (photo, price, beds/baths inline) and disambiguates the page for LLMs.
  // RealEstateListing is the type Google's Real Estate structured data docs
  // reference; it's broader than SingleFamilyResidence (covers condos, PHs,
  // etc) which matches our listing mix. Hardcoded addressCountry='US' — most
  // listings are US-based; can be made dynamic if international volume grows.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
  const locationParts = listing.location.split(",").map((s) => s.trim());
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description.slice(0, 500),
    url: `${siteUrl}/listings/${listing.slug}`,
    image: [listing.hero_image_url, ...galleryItems.map((g) => g.url)].slice(0, 10),
    address: {
      "@type": "PostalAddress",
      addressLocality: locationParts[0] || listing.location,
      addressRegion: locationParts[1] || "",
      addressCountry: "US"
    },
    ...(listing.bedrooms !== null && { numberOfRooms: listing.bedrooms }),
    ...(listing.bathrooms !== null && { numberOfBathroomsTotal: listing.bathrooms }),
    ...(listing.square_feet !== null && {
      floorSize: {
        "@type": "QuantitativeValue",
        value: listing.square_feet,
        unitCode: "FTK"
      }
    }),
    ...(listing.published_at && { datePosted: listing.published_at }),
    offers: {
      "@type": "Offer",
      // Sold listings still surface an offer price for search rich-results —
      // use the sale price when disclosed, otherwise fall back to the original
      // ask. Availability flips so SERPs show the correct state.
      price: isSold && listing.sold_price_usd !== null ? listing.sold_price_usd : listing.price_usd,
      priceCurrency: "USD",
      availability: isSold ? "https://schema.org/SoldOut" : "https://schema.org/InStock"
    }
  };

  // Broker is populated when the listing carries agent credit; omitted
  // otherwise so we don't emit a half-empty RealEstateAgent stub.
  if (listing.agent_name) {
    structuredData.broker = {
      "@type": "RealEstateAgent",
      name: listing.agent_name,
      ...(listing.agent_brokerage && {
        worksFor: {
          "@type": "Organization",
          name: listing.agent_brokerage
        }
      })
    };
  }

  return (
    <ListingMediaProvider
      heroUrl={listing.hero_image_url}
      altBase={listing.title}
      gallery={galleryItems}
    >
      <article>
        <script
          type="application/ld+json"
          // Schema.org JSON-LD — rendered as invisible metadata, read by
          // search engines + LLMs for rich results + summarisation.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* Hero image — clickable, opens lightbox at slide 0 */}
        <ListingHeroImage
          src={listing.hero_image_url}
          alt={listing.title}
          soldLabel={isSold ? "Sold" : undefined}
        />

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
                {isSold ? (
                  <>
                    <p className="text-xs uppercase tracking-widest text-black/50">Sold</p>
                    <p className="font-display text-2xl text-accent mt-1">
                      {listing.sold_price_usd !== null
                        ? `Sold for ${formatPrice(listing.sold_price_usd)}`
                        : "Sold · Price undisclosed"}
                    </p>
                    <p className="text-xs text-black/50 mt-1">
                      Originally listed at {formatPrice(listing.price_usd)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-widest text-black/50">Price</p>
                    <p className="font-display text-2xl text-accent mt-1">
                      {formatPrice(listing.price_usd)}
                    </p>
                  </>
                )}
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
                // whitespace-pre-line: preserves single \n as line breaks within a
                // paragraph (e.g. typed lists), while \n\n still becomes a paragraph
                // break thanks to the split above.
                <p key={i} className="text-black/80 leading-relaxed mb-4 whitespace-pre-line">
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

          {/* Sidebar - inquire form (hidden once sold; replaced with a browse-active link) */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 border border-black/10 bg-white p-6">
              {isSold ? (
                <>
                  <h2 className="font-display text-2xl">This property has been sold.</h2>
                  <p className="text-sm text-black/60 mt-2 mb-6">
                    {listing.sold_at && (
                      <>
                        Sale closed {new Date(listing.sold_at).toLocaleDateString()}. Explore
                        other properties currently on the market.
                      </>
                    )}
                  </p>
                  <Link
                    href="/listings"
                    className="inline-block bg-ink text-paper px-5 py-3 text-xs uppercase tracking-widest hover:bg-accent transition-colors"
                  >
                    Browse active listings →
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl">Interested?</h2>
                  <p className="text-sm text-black/60 mt-1 mb-6">
                    Get connected directly with the listing agent.
                  </p>
                  <InquireForm listingId={listing.id} listingTitle={listing.title} />
                </>
              )}
            </div>
          </aside>
        </div>
      </article>
    </ListingMediaProvider>
  );
}
