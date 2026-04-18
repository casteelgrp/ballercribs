import { ImageResponse } from "next/og";
import { getListingBySlug } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const runtime = "edge";
export const alt = "BallerCribs featured listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
const LOGO_URL = `${SITE_URL}/logo-white.png`;
// Native logo is 2664x1752 (~1.52:1). Top-left watermark rendered at 200 wide.
const LOGO_WATERMARK_WIDTH = 200;
const LOGO_WATERMARK_HEIGHT = 132;

// Satori requires explicit pixel width AND height as HTML attributes on any
// <img> with an external src — it can't introspect the remote binary to
// compute intrinsic dimensions. Without these, the edge handler returns a
// 200 OK + Content-Type image/png with a 0-byte body and the edge log
// records: "Image size cannot be determined."

export default async function OpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const listing = await getListingBySlug(slug).catch(() => null);
    if (!listing) return fallbackOG();

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
          {/* Full-bleed hero photo. width+height are the canvas dimensions —
              satori needs them explicitly; object-fit handles aspect. */}
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img
            src={listing.hero_image_url}
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

          {/* Bottom gradient for text legibility */}
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

          {/* Logo watermark top-left. Absolute URL because edge runtime
              can't resolve /public relative paths. */}
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
  } catch (err) {
    console.error("[opengraph-image:listing] generation failed:", err);
    return fallbackOG();
  }
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
          The wildest luxury homes on the internet.
        </div>
      </div>
    ),
    { ...size }
  );
}
