import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baller Cribs — The wildest luxury homes on the internet",
  description:
    "Curated luxury real estate. Mega-mansions, estates, and architectural icons from around the world."
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
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/listings" className="hover:text-accent transition-colors">
                Listings
              </Link>
              <Link href="/newsletter" className="hover:text-accent transition-colors">
                Newsletter
              </Link>
              <Link
                href="https://instagram.com/ballercribs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors hidden sm:inline"
              >
                Instagram
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-black/10 mt-24 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
            <p className="text-sm text-black/60">
              Weekly luxury homes delivered free —{" "}
              <Link href="/newsletter" className="text-accent hover:underline">
                Subscribe
              </Link>
            </p>
            <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm text-black/60 pt-4 border-t border-black/5">
              <p>© {new Date().getFullYear()} Baller Cribs. All rights reserved.</p>
              <div className="flex gap-6">
                <Link href="/listings" className="hover:text-accent">
                  Listings
                </Link>
                <Link href="/newsletter" className="hover:text-accent">
                  Newsletter
                </Link>
                <Link
                  href="https://instagram.com/ballercribs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent"
                >
                  @ballercribs
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
