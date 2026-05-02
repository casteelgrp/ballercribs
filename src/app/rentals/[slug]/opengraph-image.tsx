import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getListingBySlug } from "@/lib/db";
import { formatPrice } from "@/lib/currency";
import { getSiteUrl } from "@/lib/site";

// Mirrors /app/listings/[slug]/opengraph-image.tsx — Node runtime for sharp
// (WebP → PNG transcode), full-bleed hero + price + title + location stack.
// Differs only in which getListingBySlug variant + price formatting we use;
// rentals store price in cents with a per-unit cadence, not whole dollars.
export const runtime = "nodejs";
export const alt = "BallerCribs featured rental";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = false;

const LOGO_URL = `${getSiteUrl()}/logo-white.png`;
const LOGO_WATERMARK_WIDTH = 200;
const LOGO_WATERMARK_HEIGHT = 132;

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

export default async function OpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const listing = await getListingBySlug(slug, "rental").catch(() => null);
    if (!listing) return fallbackOG();

    const heroDataUri = await fetchAsPng(listing.hero_image_url);
    const priceLine = rentalPriceText(listing);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            background: "#0a0a0a"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img
            src={heroDataUri}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)",
              display: "flex"
            }}
          />

          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img
            src={LOGO_URL}
            width={LOGO_WATERMARK_WIDTH}
            height={LOGO_WATERMARK_HEIGHT}
            style={{
              position: "absolute",
              top: 40,
              left: 48
            }}
          />

          {/* "Rental" eyebrow in the upper-right so the card reads as a
              rental at a glance — the listing OG image has no eyebrow
              because sale is the default. */}
          <div
            style={{
              position: "absolute",
              top: 56,
              right: 48,
              color: "#b8935a",
              fontSize: 22,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              display: "flex"
            }}
          >
            Rental
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 48,
              left: 48,
              right: 48,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div
              style={{
                color: "#b8935a",
                fontSize: 28,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                display: "flex"
              }}
            >
              {priceLine}
            </div>
            <div
              style={{
                color: "#fafaf7",
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                fontFamily: "serif",
                maxWidth: "900px",
                display: "flex"
              }}
            >
              {listing.title}
            </div>
            <div
              style={{
                color: "#fafaf7",
                opacity: 0.8,
                fontSize: 28,
                display: "flex"
              }}
            >
              {listing.location}
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (err) {
    console.error("[opengraph-image:rental] generation failed:", err);
    return fallbackOG();
  }
}

async function fetchAsPng(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hero fetch failed (${res.status}) for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const png = await sharp(bytes)
    .rotate()
    .resize({ width: 1200, height: 630, fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function fallbackOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={LOGO_URL} width={400} height={263} />
        <div
          style={{
            color: "#b8935a",
            fontSize: 32,
            fontFamily: "serif",
            fontStyle: "italic",
            display: "flex"
          }}
        >
          Luxury rentals, curated.
        </div>
      </div>
    ),
    { ...size }
  );
}
