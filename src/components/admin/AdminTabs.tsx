"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = {
  label: string;
  href: string;
  ownerOnly: boolean;
  matchExact?: boolean;
};

type Group = {
  label: string;
  items: Item[];
  /** When true, the whole group hides for non-owners regardless of items. */
  ownerOnly: boolean;
};

const DASHBOARD: Item = {
  label: "Dashboard",
  href: "/admin",
  ownerOnly: false,
  matchExact: true
};

const ACCOUNT: Item = { label: "Account", href: "/admin/account", ownerOnly: false };

// Content: editorial / public-facing surfaces. Listings + Blog open
// to non-owners (per-action permissions gate publish/archive); Hero
// Photos stays owner-only because it edits site-wide chrome.
const GROUPS: Group[] = [
  {
    label: "Content",
    ownerOnly: false,
    items: [
      { label: "Listings", href: "/admin/listings", ownerOnly: false },
      { label: "Blog", href: "/admin/blog", ownerOnly: false },
      { label: "Hero Photos", href: "/admin/hero-photos", ownerOnly: true }
    ]
  },
  {
    label: "Operations",
    ownerOnly: true,
    items: [
      { label: "Inquiries", href: "/admin/inquiries", ownerOnly: true },
      { label: "Payments", href: "/admin/payments", ownerOnly: true }
    ]
  },
  {
    label: "Setup",
    ownerOnly: true,
    items: [
      { label: "Partners", href: "/admin/partners", ownerOnly: true },
      { label: "Users", href: "/admin/users", ownerOnly: true }
    ]
  }
];

function isItemActive(pathname: string, item: Item): boolean {
  return item.matchExact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AdminTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname() ?? "/admin";

  // Single-open dropdown — opening one closes any other. Tracking the
  // open group's label as a string keeps state minimal and serializable.
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Outside-click + Esc close. Bound at the nav root so a click on
  // the trigger of another dropdown counts as inside (its onClick
  // toggles open state directly).
  useEffect(() => {
    if (openLabel === null) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target as Node)) {
        setOpenLabel(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenLabel(null);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openLabel]);

  // Close the dropdown when the route changes — clicking a link
  // inside a dropdown triggers a Next.js client navigation, the
  // pathname changes, and the menu collapses on its own.
  useEffect(() => {
    setOpenLabel(null);
  }, [pathname]);

  const visibleGroups = GROUPS.filter((g) => {
    if (g.ownerOnly && !isOwner) return false;
    return g.items.some((item) => !item.ownerOnly || isOwner);
  });

  return (
    <nav
      ref={navRef}
      className="flex gap-1 overflow-x-auto -mb-px relative"
      aria-label="Admin sections"
    >
      <TabLink item={DASHBOARD} pathname={pathname} />

      {visibleGroups.map((group) => {
        const visibleItems = group.items.filter(
          (item) => !item.ownerOnly || isOwner
        );
        const groupActive = visibleItems.some((item) =>
          isItemActive(pathname, item)
        );
        const isOpen = openLabel === group.label;
        return (
          <div key={group.label} className="relative whitespace-nowrap">
            <button
              type="button"
              onClick={() => setOpenLabel(isOpen ? null : group.label)}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              className={
                "px-3 py-2 text-sm uppercase tracking-widest border-b-2 transition-colors flex items-center gap-1.5 " +
                (groupActive
                  ? "border-accent text-ink"
                  : "border-transparent text-black/50 hover:text-ink")
              }
            >
              <span>{group.label}</span>
              {/* Inline chevron — rotates 180° when open. Inline SVG to
                  match the project convention of avoiding icon deps for
                  one or two glyphs. */}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
                className={
                  "transition-transform " + (isOpen ? "rotate-180" : "")
                }
              >
                <path
                  d="M2 3.5L5 6.5L8 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-px min-w-[180px] bg-white border border-black/15 shadow-md z-30"
              >
                {visibleItems.map((item) => {
                  const active = isItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className={
                        "block px-3 py-2 text-sm transition-colors " +
                        (active
                          ? "bg-black/[0.05] text-ink"
                          : "text-black/70 hover:bg-black/[0.03] hover:text-ink")
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Account pinned right via ml-auto so the dropdowns left-align
          and the user-tied link sits in the conventional position.
          On a horizontally-scrolling mobile nav, ml-auto behaves like
          a regular last-flex-child since there's no free width. */}
      <div className="ml-auto">
        <TabLink item={ACCOUNT} pathname={pathname} />
      </div>
    </nav>
  );
}

function TabLink({ item, pathname }: { item: Item; pathname: string }) {
  const active = isItemActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={
        "px-3 py-2 text-sm uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap " +
        (active
          ? "border-accent text-ink"
          : "border-transparent text-black/50 hover:text-ink")
      }
      aria-current={active ? "page" : undefined}
    >
      {item.label}
    </Link>
  );
}
