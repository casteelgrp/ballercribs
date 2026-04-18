import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SocialLinks } from "@/components/SocialLinks";
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
        <header className="border-b border-black/10 bg-paper/95 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/logo-black.png"
                alt="BallerCribs"
                width={180}
                height={36}
                className="h-9 w-auto"
                priority
              />
            </Link>
            <nav className="flex items-center gap-3 sm:gap-5 text-sm">
              <Link href="/listings" className="hover:text-accent transition-colors">
                Listings
              </Link>
              <Link href="/newsletter" className="hover:text-accent transition-colors">
                Newsletter
              </Link>
              <Link href="/agents" className="hover:text-accent transition-colors">
                For Agents
              </Link>
              {/* Vertical divider — hidden on the very narrow viewports
                  where every horizontal pixel matters. */}
              <span className="hidden sm:inline-block h-4 w-px bg-black/20" aria-hidden="true" />
              <SocialLinks />
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-black/10 mt-24 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-black/60">
            <p>© {new Date().getFullYear()} Baller Cribs. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/listings" className="hover:text-accent">
                Listings
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
