import { ImageResponse } from "next/og";
import { getListingBySlug } from "@/lib/db";
import { formatPrice } from "@/lib/format";

// Edge runtime: faster cold start, cheaper execution, and @vercel/postgres
// is edge-compatible (Neon's serverless driver talks over HTTP fetch).
export const runtime = "edge";
export const alt = "BallerCribs featured listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Next 15: params is a Promise.
export default async function OpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug).catch(() => null);

  if (!listing) {
    // Fallback if the slug doesn't resolve (unpublished, deleted, etc.)
    return new ImageResponse(
      (
        <div
          style={{
            background: "#0a0a0a",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fafaf7",
            fontSize: 72,
            fontFamily: "serif"
          }}
        >
          BallerCribs
        </div>
      ),
      { ...size }
    );
  }

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
        {/* Full-bleed hero photo */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={listing.hero_image_url}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />

        {/* Gradient overlay for legibility — heavier at the bottom where text sits. */}
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

        {/* Wordmark watermark — text, not an image. ImageResponse + edge
            has quirks loading local PNGs; a serif wordmark renders reliably. */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 48,
            color: "#fafaf7",
            fontSize: 32,
            fontWeight: 700,
            fontFamily: "serif",
            letterSpacing: "-0.02em",
            display: "flex"
          }}
        >
          BallerCribs
        </div>

        {/* Bottom content block */}
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
            {formatPrice(listing.price_usd)}
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
}
