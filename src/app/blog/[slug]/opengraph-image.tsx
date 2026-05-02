import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getCategories, getPostBySlug } from "@/lib/blog-queries";
import { getSiteUrl } from "@/lib/site";

// Node runtime (not edge): satori can't decode WebP, and blog cover
// images flow through the same upload pipeline that emits .webp. We
// fetch the cover, transcode to PNG, embed as data URI — same approach
// as /listings and /rentals OG images.
export const runtime = "nodejs";
export const alt = "BallerCribs blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = false;

const LOGO_URL = `${getSiteUrl()}/logo-white.png`;
const LOGO_WATERMARK_WIDTH = 200;
const LOGO_WATERMARK_HEIGHT = 132;

export default async function OpengraphImage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug).catch(() => null);
    if (!post) return fallbackOG();

    const [categories, coverDataUri] = await Promise.all([
      getCategories().catch(() => []),
      post.socialCoverUrl
        ? fetchAsPng(post.socialCoverUrl).catch(() => null)
        : post.coverImageUrl
          ? fetchAsPng(post.coverImageUrl).catch(() => null)
          : Promise.resolve(null)
    ]);

    const categoryLabel =
      categories.find((c) => c.slug === post.categorySlug)?.name ??
      post.categorySlug;

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
          {/* Cover as full-bleed backdrop when present; falls back to a
              flat dark canvas so the title-first layout still reads
              cleanly for cover-less posts.

              Cover + gradient are rendered as two separate conditional
              siblings (no shared fragment) so satori sees them as
              direct children of the root container, identical in
              shape to the listing/rental OG structures. The previous
              `{cond && <>cover gradient</>}` form caused the watermark
              `<img>` below to silently drop in production satori
              renders — fragment-hoisting pushes a sibling that
              follows it out of the paint chain. */}
          {coverDataUri && (
            /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */
            <img
              src={coverDataUri}
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
          )}
          {coverDataUri && (
            /* Heavier darken than the listing/rental OG — blog titles
               run longer, and article cards are read, not glanced at.
               Contrast wins over picture fidelity here. */
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.5) 100%)",
                display: "flex"
              }}
            />
          )}

          {/* Logo watermark, top-left, matches the listings/rentals OG. */}
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

          {/* Category eyebrow top-right — mirrors the "Rental" eyebrow
              on the rental OG so the three detail-page OG cards share a
              consistent typographic scaffold. */}
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
            {categoryLabel}
          </div>

          {/* Bottom content block. No price/location like listings —
              blog cards just get title + subtitle (or excerpt) so the
              article premise lands in-share. */}
          <div
            style={{
              position: "absolute",
              bottom: 48,
              left: 48,
              right: 48,
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
          >
            <div
              style={{
                color: "#fafaf7",
                fontSize: 60,
                fontWeight: 700,
                lineHeight: 1.05,
                fontFamily: "serif",
                maxWidth: "1050px",
                display: "flex"
              }}
            >
              {post.title}
            </div>
            {(post.subtitle || post.excerpt) && (
              <div
                style={{
                  color: "#fafaf7",
                  opacity: 0.8,
                  fontSize: 26,
                  lineHeight: 1.3,
                  maxWidth: "1000px",
                  display: "flex"
                }}
              >
                {truncate(post.subtitle || post.excerpt || "", 140)}
              </div>
            )}
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (err) {
    console.error("[opengraph-image:blog] generation failed:", err);
    return fallbackOG();
  }
}

async function fetchAsPng(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cover fetch failed (${res.status}) for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const png = await sharp(bytes)
    .rotate()
    .resize({ width: 1200, height: 630, fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function truncate(s: string, max: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const slice = one.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? lastSpace : max;
  return one.slice(0, cut).trimEnd() + "…";
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
          Notes from the world of luxury real estate.
        </div>
      </div>
    ),
    { ...size }
  );
}
