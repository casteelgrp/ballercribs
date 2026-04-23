"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SocialLinks, SOCIALS } from "./SocialLinks";

// Top nav is consumer-focused — Listings / Rentals / Newsletter. "For
// Agents" is B2B, lives only in the footer; agents self-select and don't
// need a top-nav slot to find it.
const NAV_LINKS = [
  { href: "/listings", label: "Listings" },
  { href: "/rentals", label: "Rentals" },
  { href: "/blog", label: "Blog" },
  { href: "/newsletter", label: "Newsletter" }
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Login is a focused entry point — no public nav or branding chrome on top.
  // Every other route (including /admin/*) keeps the header so signed-in users
  // can jump back to the public site. Gate lives after hooks to keep hook order
  // stable across route transitions.
  if (pathname === "/admin/login") return null;

  function close() {
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  return (
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

        {/* Desktop / tablet-landscape nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-accent transition-colors">
              {label}
            </Link>
          ))}
          <span className="inline-block h-4 w-px bg-black/20" aria-hidden="true" />
          <SocialLinks />
        </nav>

        {/* Mobile hamburger — 44x44 tap target, padding sits inside the button */}
        <button
          ref={buttonRef}
          type="button"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 text-ink hover:text-accent transition-colors"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsOpen((o) => !o)}
        >
          {isOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Backdrop — catches taps outside the menu and closes it. Sits below
          the slide-down panel in DOM order so the panel paints on top. */}
      <div
        className={`md:hidden fixed inset-x-0 top-16 bottom-0 bg-black/20 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
        onClick={close}
      />

      {/* Mobile menu panel */}
      <nav
        id="mobile-nav"
        aria-label="Mobile"
        className={`md:hidden overflow-hidden border-t border-black/10 bg-paper relative transition-all duration-200 ease-out ${
          isOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <ul className="flex flex-col py-2">
          {NAV_LINKS.map(({ href, label }, i) => (
            <li key={href}>
              <Link
                href={href}
                ref={i === 0 ? firstLinkRef : undefined}
                onClick={close}
                className="block px-6 py-3 min-h-[48px] text-base hover:bg-black/5 hover:text-accent transition-colors"
              >
                {label}
              </Link>
            </li>
          ))}
          <li aria-hidden="true">
            <div className="mx-6 my-2 border-t border-black/10" />
          </li>
          {SOCIALS.map(({ href, label, name, Icon }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                onClick={close}
                className="flex items-center gap-3 px-6 py-3 min-h-[48px] text-base text-ink/80 hover:bg-black/5 hover:text-accent transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span>{name}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
