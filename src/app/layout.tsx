import type { Metadata } from "next";
import Link from "next/link";
import { SocialLinks } from "@/components/SocialLinks";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "BallerCribs — Luxury homes, mega-mansions, and architectural icons for sale",
  description:
    "The wildest luxury homes on the internet. Curated mega-mansions, architectural estates, and iconic properties from around the world. Featured daily on Instagram and across all platforms."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />

        <main className="flex-1">{children}</main>

        <footer className="border-t border-black/10 mt-24 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-black/60">
            <p>© {new Date().getFullYear()} BallerCribs. All rights reserved.</p>
            <div className="flex items-center gap-6 flex-wrap">
              <Link href="/listings" className="hover:text-accent">
                Listings
              </Link>
              <Link href="/sold" className="hover:text-accent">
                Sold
              </Link>
              <Link href="/agents" className="hover:text-accent">
                For Agents
              </Link>
              <SocialLinks />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
