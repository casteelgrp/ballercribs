"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SocialLinks } from "./SocialLinks";

export function SiteFooter() {
  const pathname = usePathname();
  const minimal = pathname === "/admin/login";

  return (
    <footer className="border-t border-black/10 mt-24 py-10">
      <div
        className={
          "max-w-7xl mx-auto px-4 sm:px-6 text-sm text-black/60 " +
          (minimal
            ? "text-center"
            : "flex flex-col gap-5")
        }
      >
        {!minimal && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} BallerCribs. All rights reserved.</p>
            <div className="flex items-center gap-6 flex-wrap">
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
              <SocialLinks />
            </div>
          </div>
        )}
        {!minimal && (
          <div className="flex items-center gap-6 flex-wrap text-xs text-black/50">
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
            <Link href="/referral-disclosure" className="hover:text-accent">
              Referral Disclosure
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
