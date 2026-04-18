import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getListingBySlug } from "@/lib/db";
import { formatPrice } from "@/lib/format";

// Node runtime, not edge: satori doesn't support WebP, and every listing
// hero photo goes through our sharp pipeline that outputs .webp. We pre-
// fetch the hero, transcode to PNG with sharp (Node-only native dep), and
// embed as a data URI so satori never sees the WebP directly.
export const runtime = "nodejs";
export const alt = "BallerCribs featured listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = false; // cache forever; Next auto-invalidates on slug change

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
const LOGO_URL = `${SITE_URL}/logo-white.png`;
// Native logo is 2664x1752 (~1.52:1). Attributes below preserve aspect.
const LOGO_WATERMARK_WIDTH = 200;
const LOGO_WATERMARK_HEIGHT = 132;

export default async function OpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const listing = await getListingBySlug(slug).catch(() => null);
    if (!listing) return fallbackOG();

    const heroDataUri = await fetchAsPng(listing.hero_image_url);

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
          {/* Full-bleed hero — data URI, so satori doesn't re-fetch the remote
              WebP (which it can't decode). width+height = canvas dims. */}
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

          {/* Bottom gradient for legibility */}
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

          {/* Logo watermark top-left — PNG, satori-safe, absolute URL. */}
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

/**
 * Fetch a remote image, resize to the OG canvas, transcode to PNG, return
 * a data URI. Handles WebP/JPEG/PNG/AVIF/HEIC — whatever the hero happens
 * to be — because sharp decodes all of them but satori only reads PNG/JPEG/GIF.
 *
 * Resizing here (not just at satori render time) keeps the embedded payload
 * small: a 2000px hero transcodes to ~150-400KB PNG at 1200x630 vs several MB
 * if we embedded the full-res transcode.
 */
async function fetchAsPng(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hero fetch failed (${res.status}) for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const png = await sharp(bytes)
    .rotate() // respect EXIF orientation
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
          The wildest luxury homes on the internet.
        </div>
      </div>
    ),
    { ...size }
  );
}
