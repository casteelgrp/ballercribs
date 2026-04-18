import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BallerCribs — The wildest luxury homes on the internet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
const LOGO_URL = `${SITE_URL}/logo-white.png`;
// Native logo 2664x1752 (~1.52:1). Centered at 400 wide.
const LOGO_WIDTH = 400;
const LOGO_HEIGHT = 263;

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
        {/* Absolute URL + explicit width/height — required by satori at edge. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={LOGO_URL} width={LOGO_WIDTH} height={LOGO_HEIGHT} />
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
