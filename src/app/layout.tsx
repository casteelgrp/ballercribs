import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";

export const metadata: Metadata = {
  // metadataBase resolves the relative URLs Next.js builds for OG + canonical
  // tags. Set per-environment via NEXT_PUBLIC_SITE_URL; production Vercel env
  // should override the fallback to the real domain once it lands.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BallerCribs | The wildest luxury homes on the internet",
    // Per-page titles set `title: 'X'` and render as 'X | BallerCribs'.
    // Pages that need a standalone headline (e.g. the newsletter page) can
    // opt out via `title: { absolute: '...' }`.
    template: "%s | BallerCribs"
  },
  description:
    "Curated luxury real estate features — estates, penthouses, and architectural landmarks from the top agents in the country. 234K+ follow along on Instagram.",
  applicationName: "BallerCribs",
  openGraph: {
    type: "website",
    siteName: "BallerCribs",
    url: SITE_URL,
    title: "BallerCribs | The wildest luxury homes on the internet",
    description:
      "Curated luxury real estate features — estates, penthouses, and architectural landmarks from the top agents in the country."
    // images: auto-injected from src/app/opengraph-image.tsx (1200x630
    // branded card). Override per-route by adding a sibling opengraph-image
    // to that route's directory.
  },
  twitter: {
    card: "summary_large_image",
    site: "@ballercribs",
    title: "BallerCribs | The wildest luxury homes on the internet",
    description: "The wildest luxury homes on the internet. 234K+ on Instagram."
  },
  robots: {
    index: true,
    follow: true
  }
  // Canonical is set per-route rather than here — root-level alternates
  // propagate to every child and would give admin/error pages the wrong
  // canonical. Each page + the homepage set their own alternates.canonical.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
