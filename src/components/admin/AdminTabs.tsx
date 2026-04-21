"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { label: string; href: string; ownerOnly: boolean; matchExact: boolean };

const TABS: Tab[] = [
  { label: "Dashboard", href: "/admin", ownerOnly: false, matchExact: true },
  { label: "Listings", href: "/admin/listings", ownerOnly: false, matchExact: false },
  { label: "Inquiries", href: "/admin/inquiries", ownerOnly: true, matchExact: false },
  { label: "Hero Photos", href: "/admin/hero-photos", ownerOnly: true, matchExact: false },
  { label: "Users", href: "/admin/users", ownerOnly: true, matchExact: false },
  { label: "Account", href: "/admin/account", ownerOnly: false, matchExact: false }
];

export function AdminTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname() ?? "/admin";
  const visible = TABS.filter((t) => !t.ownerOnly || isOwner);

  return (
    <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Admin sections">
      {visible.map((t) => {
        const active = t.matchExact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "px-3 py-2 text-sm uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap " +
              (active
                ? "border-accent text-ink"
                : "border-transparent text-black/50 hover:text-ink")
            }
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
