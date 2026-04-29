"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SocialLinks } from "./SocialLinks";

export function SiteFooter() {
  const pathname = usePathname();
  const minimal = pathname === "/admin/login";

  return (
    <footer className="border-t border-black/10 py-10">
      <div
        className={
          "max-w-7xl mx-auto px-4 sm:px-6 text-sm text-black/60 " +
          (minimal
            ? "text-center"
            : "flex flex-col gap-5")
        }
      >
        {!minimal && (
          // Mobile: nav row → social row → copyright (via `order-*`).
          // Desktop: copyright on the left, nav+social cluster on the
          // right (sm:order-* restores the today-shipping layout).
          // The cluster wrapper is flex-col on mobile so nav links and
          // socials stack as two separate rows; sm:flex-row recombines
          // them inline at desktop with the same gap-6 spacing the
          // footer already uses for inter-link rhythm.
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="order-3 sm:order-none text-center sm:text-left">
              © {new Date().getFullYear()} BallerCribs. All rights reserved.
            </p>
            <div className="order-1 sm:order-none flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 sm:flex-wrap">
              <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start">
                <Link href="/listings" className="hover:text-accent">
                  Listings
                </Link>
                <Link href="/rentals" className="hover:text-accent">
                  Rentals
                </Link>
                <Link href="/blog" className="hover:text-accent">
                  Blog
                </Link>
                <Link href="/agents" className="hover:text-accent">
                  For Agents
                </Link>
              </div>
              <div className="flex justify-center sm:justify-start">
                <SocialLinks />
              </div>
            </div>
          </div>
        )}
        {!minimal && (
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start text-xs text-black/50">
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
            <Link href="/disclosures" className="hover:text-accent">
              Disclosures
            </Link>
          </div>
        )}
        {minimal && (
          <p>© {new Date().getFullYear()} BallerCribs. All rights reserved.</p>
        )}
      </div>
    </footer>
  );
}
