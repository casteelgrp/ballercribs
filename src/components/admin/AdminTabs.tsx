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

const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 200;

function isItemActive(pathname: string, item: Item): boolean {
  return item.matchExact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AdminTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname() ?? "/admin";

  // Single-open dropdown — opening one closes any other.
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Hover gate: only attach hover handlers on devices that actually
  // hover. Touch devices report `(hover: none)` and fall through to
  // click-only — preserves the touch-tap UX without the open-on-tap-
  // then-immediate-close glitch caused by mouseleave firing right
  // after a touch.
  const [hoverEnabled, setHoverEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover)");
    setHoverEnabled(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHoverEnabled(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Hover delay timers. One pair per nav: opening or closing cancels
  // the opposite pending timer so a quick re-enter after leave doesn't
  // dispatch a stale close.
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearOpenTimer = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };
  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  function scheduleOpen(label: string) {
    clearCloseTimer();
    if (openLabel === label) return;
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setOpenLabel(label);
      openTimerRef.current = null;
    }, HOVER_OPEN_MS);
  }
  function scheduleClose() {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenLabel(null);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_MS);
  }

  // Outside-click + Esc close — both bypass the hover-delay timers
  // for a snappy close on intentional dismissal.
  useEffect(() => {
    if (openLabel === null) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target as Node)) {
        clearOpenTimer();
        clearCloseTimer();
        setOpenLabel(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        clearOpenTimer();
        clearCloseTimer();
        setOpenLabel(null);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openLabel]);

  // Route change closes any open dropdown immediately. clearOpenTimer/
  // clearCloseTimer are stable closures so React lint doesn't need them
  // in deps; pathname is the only effective dependency.
  useEffect(() => {
    clearOpenTimer();
    clearCloseTimer();
    setOpenLabel(null);
  }, [pathname]);

  // Cleanup any pending timers on unmount.
  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, []);

  const visibleGroups = GROUPS.filter((g) => {
    if (g.ownerOnly && !isOwner) return false;
    return g.items.some((item) => !item.ownerOnly || isOwner);
  });

  return (
    // overflow-x-auto on the nav root was clipping the dropdown panel
    // (CSS forces orthogonal overflow-y to clip when one axis is auto).
    // flex-wrap handles narrow viewports by stacking trigger rows
    // instead of horizontal scrolling — admin surface, not public.
    <nav
      ref={navRef}
      className="flex gap-1 -mb-px relative flex-wrap"
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

        // Hover handlers only attached when the device supports hover.
        // Touch devices fall through to onClick which toggles immediately.
        const hoverHandlers = hoverEnabled
          ? {
              onMouseEnter: () => scheduleOpen(group.label),
              onMouseLeave: () => scheduleClose()
            }
          : {};

        return (
          <div
            key={group.label}
            className="relative whitespace-nowrap"
            {...hoverHandlers}
          >
            <button
              type="button"
              onClick={() => {
                // Click bypasses the hover delay — toggling is instant.
                clearOpenTimer();
                clearCloseTimer();
                setOpenLabel(isOpen ? null : group.label);
              }}
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
