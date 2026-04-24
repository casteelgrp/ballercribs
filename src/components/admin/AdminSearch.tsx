"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AdminSearchResults,
  SearchBlogPost,
  SearchListing
} from "@/types/search";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-black/10 text-black/70",
  review: "bg-accent/20 text-accent",
  published: "bg-green-100 text-green-800",
  archived: "bg-black/20 text-black/40"
};

const TYPE_BADGE: Record<"sale" | "rental", string> = {
  sale: "bg-slate-100 text-slate-700",
  rental: "bg-stone-200 text-stone-700"
};

const DEBOUNCE_MS = 200;
const DROPDOWN_LIMIT = 5;

/**
 * Admin top-bar search. Debounced dropdown preview of up to 5 results
 * per kind, with a "See all results" fall-through to /admin/search.
 *
 * Enter on the input routes to the full results page; Escape closes
 * the dropdown without navigating. Click-outside closes. Keyboard
 * navigation inside the dropdown is browser-default (Tab through
 * links) — explicit arrow-key nav is a later polish.
 */
export function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch. 200ms is low enough that typing feels live but
  // high enough that a fast typist doesn't spam the endpoint per
  // keystroke. Clears results when the query empties.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}&limit=${DROPDOWN_LIMIT}`
        );
        if (!res.ok) {
          setResults(null);
          return;
        }
        const data = (await res.json()) as AdminSearchResults;
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside closes the dropdown without clearing the input —
  // the author may just be switching focus, keep their query handy.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/admin/search?q=${encodeURIComponent(trimmed)}`);
  }

  const hasResults =
    results !== null &&
    (results.listings.length > 0 || results.blogs.length > 0);
  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative w-full sm:w-72">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search listings, blog…"
          aria-label="Search admin"
          className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </form>

      {showDropdown && (
        <div className="absolute z-30 mt-1 left-0 right-0 border border-black/10 bg-white shadow-lg max-h-[70vh] overflow-y-auto">
          {loading && !results && (
            <div className="px-3 py-3 text-xs uppercase tracking-widest text-black/50">
              Searching…
            </div>
          )}
          {results && !hasResults && (
            <div className="px-3 py-4 text-sm text-black/60">
              No matches for <span className="font-medium">{query}</span>.
            </div>
          )}
          {results && results.listings.length > 0 && (
            <section>
              <h3 className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-black/50">
                Listings ({results.listings.length})
              </h3>
              <ul className="divide-y divide-black/5">
                {results.listings.map((r) => (
                  <li key={`l-${r.id}`}>
                    <ListingResultRow result={r} onPick={() => setOpen(false)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results && results.blogs.length > 0 && (
            <section>
              <h3 className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-black/50">
                Blog posts ({results.blogs.length})
              </h3>
              <ul className="divide-y divide-black/5">
                {results.blogs.map((r) => (
                  <li key={`b-${r.id}`}>
                    <BlogResultRow result={r} onPick={() => setOpen(false)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {hasResults && (
            <div className="border-t border-black/10 bg-black/[0.02]">
              <Link
                href={`/admin/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-xs uppercase tracking-widest text-accent hover:bg-black/5"
              >
                See all results →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListingResultRow({
  result,
  onPick
}: {
  result: SearchListing;
  onPick: () => void;
}) {
  return (
    <Link
      href={`/admin/listings/${result.id}/edit`}
      onClick={onPick}
      className="block px-3 py-2.5 hover:bg-black/[0.03] transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">
          {result.title}
        </span>
        <Badge className={TYPE_BADGE[result.listingType]}>
          {result.listingType}
        </Badge>
        <Badge className={STATUS_BADGE[result.status] ?? STATUS_BADGE.draft}>
          {result.soldAt ? "sold" : result.status}
        </Badge>
      </div>
      {result.snippet && (
        <p className="text-xs text-black/55 mt-0.5 line-clamp-1">
          {result.snippet}
        </p>
      )}
      <p className="text-[10px] uppercase tracking-widest text-black/40 mt-0.5">
        {result.location}
      </p>
    </Link>
  );
}

function BlogResultRow({
  result,
  onPick
}: {
  result: SearchBlogPost;
  onPick: () => void;
}) {
  return (
    <Link
      href={`/admin/blog/${result.id}/edit`}
      onClick={onPick}
      className="block px-3 py-2.5 hover:bg-black/[0.03] transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">
          {result.title}
        </span>
        <Badge className={STATUS_BADGE[result.status] ?? STATUS_BADGE.draft}>
          {result.status}
        </Badge>
      </div>
      {result.snippet && (
        <p className="text-xs text-black/55 mt-0.5 line-clamp-1">
          {result.snippet}
        </p>
      )}
    </Link>
  );
}

function Badge({
  className,
  children
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        "text-[9px] uppercase tracking-widest px-1.5 py-0.5 " + className
      }
    >
      {children}
    </span>
  );
}
