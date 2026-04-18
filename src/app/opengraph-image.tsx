import { ImageResponse } from "next/og";

// Site-wide default OG image. Next.js uses this for any route that doesn't
// define its own opengraph-image.* file (e.g. /, /listings, /newsletter,
// /agents). Listings get their own per-slug image from
// src/app/listings/[slug]/opengraph-image.tsx.
export const runtime = "edge";
export const alt = "BallerCribs — The wildest luxury homes on the internet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function DefaultOG() {
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
        <div
          style={{
            color: "#fafaf7",
            fontSize: 96,
            fontWeight: 700,
            fontFamily: "serif",
            letterSpacing: "-0.02em",
            display: "flex"
          }}
        >
          BallerCribs
        </div>
        <div
          style={{
            color: "#b8935a",
            fontSize: 36,
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
