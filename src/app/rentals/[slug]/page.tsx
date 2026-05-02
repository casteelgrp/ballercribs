import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getListingBySlug, getPartnerById } from "@/lib/db";
import { formatPrice } from "@/lib/currency";
import { formatSqft } from "@/lib/format";
import { stripMarkdown } from "@/lib/markdown";
import { getSiteUrl } from "@/lib/site";
import { JsonLd, breadcrumbListSchema } from "@/lib/jsonld";
import { ListingDescription } from "@/components/ListingDescription";
import { BookingPartnerBlock } from "@/components/BookingPartnerBlock";
import { NewsletterCTA } from "@/components/NewsletterCTA";
import {
  ListingGalleryGrid,
  ListingHeroImage,
  ListingMediaProvider
} from "@/components/ListingMedia";

export const revalidate = 60;

const UNIT_LABEL: Record<"night" | "week", string> = {
  night: "night",
  week: "week"
};

function rentalPriceText(listing: {
  rental_price_cents: number | null;
  rental_price_unit: "night" | "week" | null;
  currency: string;
}): string {
  if (listing.rental_price_cents === null || listing.rental_price_unit === null) {
    return "Price on request";
  }
  const whole = Math.round(listing.rental_price_cents / 100);
  return `from ${formatPrice(whole, listing.currency)}/${UNIT_LABEL[listing.rental_price_unit]}`;
}

function truncateAtWord(raw: string, maxLen: number): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  const slice = oneLine.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.6 ? lastSpace : maxLen;
  return oneLine.slice(0, cut).trimEnd() + "…";
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug, "rental").catch(() => null);
  if (!listing) return { title: { absolute: "Rental not found" } };

  const plainDesc = stripMarkdown(listing.description);
  const autoDesc = truncateAtWord(plainDesc, 155);
  const searchTitle = listing.seo_title?.trim() || listing.title;
  const searchDesc = listing.seo_description?.trim() || autoDesc;

  return {
    // Same absolute-title treatment as /listings/[slug] — we don't want
    // "| BallerCribs" eating SERP real estate for a rental name.
    title: { absolute: searchTitle },
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
      canonical: `/rentals/${listing.slug}`
    }
  };
}

export default async function RentalDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug, "rental").catch(() => null);
  if (!listing) notFound();

  // Partner row drives the booking-block render shape (D9). All
  // rentals are now backfilled with a partner_id, but the lookup is
  // tolerant — a NULL partner_id (unexpected) falls through to the
  // pre-D9 inquiry-form behavior via getPartnerById's null return.
  const partner = listing.partner_id
    ? await getPartnerById(listing.partner_id).catch(() => null)
    : null;

  const galleryItems = listing.gallery_image_urls;
  const priceLine = rentalPriceText(listing);
  const plainDescription = stripMarkdown(listing.description);

  // JSON-LD: Schema.org Accommodation is the supertype Google accepts for
  // short-term rentals and vacation properties. We fill the fields we
  // actually have — skipping the more specific LodgingBusiness since it
  // pulls in a lot of business-context fields (hours, photos of staff)
  // that don't apply to an individual rental listing.
  const siteUrl = getSiteUrl();
  const locationParts = listing.location.split(",").map((s) => s.trim());
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: listing.title,
    description: plainDescription.slice(0, 500),
    url: `${siteUrl}/rentals/${listing.slug}`,
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
    ...(listing.rental_price_cents !== null &&
      listing.rental_price_unit !== null && {
        offers: {
          "@type": "Offer",
          price: Math.round(listing.rental_price_cents / 100),
          priceCurrency: listing.currency,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: Math.round(listing.rental_price_cents / 100),
            priceCurrency: listing.currency,
            unitCode: listing.rental_price_unit === "night" ? "DAY" : "WEE"
          },
          availability: "https://schema.org/InStock"
        }
      })
  };

  if (listing.agent_name) {
    structuredData.broker = {
      "@type": "RealEstateAgent",
      name: listing.agent_name,
      ...(listing.agent_brokerage && {
        worksFor: { "@type": "Organization", name: listing.agent_brokerage }
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <JsonLd
          data={breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Rentals", url: "/rentals" },
            { name: listing.title, url: `/rentals/${listing.slug}` }
          ])}
        />
        <ListingHeroImage src={listing.hero_image_url} alt={listing.title} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <Link
              href="/rentals"
              className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
            >
              ← All rentals
            </Link>
            <p className="text-xs uppercase tracking-widest text-accent mt-4">Rental</p>
            <h1 className="font-display text-3xl sm:text-5xl mt-2 leading-tight">
              {listing.title}
            </h1>
            <p className="text-black/60 mt-2 text-lg">{listing.location}</p>

            <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-y border-black/10 py-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-black/50">Price</p>
                <p className="font-display text-2xl text-accent mt-1">{priceLine}</p>
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
                  <p className="font-display text-2xl mt-1">
                    {formatSqft(listing.square_feet)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 max-w-none text-lg">
              <ListingDescription markdown={listing.description} />
            </div>

            {galleryItems.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xs uppercase tracking-widest text-black/50 mb-4">
                  Gallery
                </h2>
                <ListingGalleryGrid gallery={galleryItems} altBase={listing.title} />
              </div>
            )}

            {/* "Listed by agent / brokerage" deliberately removed in D9 —
                rentals don't have listing agents in our model. The
                BookingPartnerBlock sidebar carries the fulfillment
                relationship explicitly. */}
          </div>

          {/* Sidebar — booking partner block. Render shape (logo / CTA /
              disclosure) depends on partner.cta_mode; outbound_link
              partners get a tracking-URL CTA, inquiry_form partners
              keep the existing /rentals?property= flow. Falls back to
              the inquiry-form layout when partner is null (defensive
              against any rental that somehow loses its partner_id). */}
          <aside className="lg:col-span-1">
            {partner ? (
              <BookingPartnerBlock listing={listing} partner={partner} />
            ) : (
              <div className="lg:sticky lg:top-24 border border-black/10 bg-white p-6">
                <h2 className="font-display text-2xl">Interested?</h2>
                <p className="text-sm text-black/60 mt-1 mb-6">
                  Tell us when you&apos;re thinking + who&apos;s coming and
                  we&apos;ll connect you with the right rental agent.
                </p>
                <Link
                  href={`/rentals?property=${encodeURIComponent(listing.slug)}#inquire`}
                  className="inline-block bg-ink text-paper px-5 py-3 text-xs uppercase tracking-widest hover:bg-accent transition-colors w-full text-center"
                >
                  Inquire about this rental →
                </Link>
                <p className="text-[11px] text-black/45 mt-4 text-center">
                  Typical reply within 48 business hours.
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* Full-bleed newsletter band. Added in D6 so all three detail
            page types (listings / rentals / blog) share the same
            conversion ask. Default context="item" keeps "Like this one?"
            — fits the rental-detail framing. */}
        <NewsletterCTA variant="compact" />
      </article>
    </ListingMediaProvider>
  );
}
