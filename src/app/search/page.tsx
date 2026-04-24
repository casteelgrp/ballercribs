import type { Metadata } from "next";
import Link from "next/link";
import { searchPublic } from "@/lib/search";
import type { SearchBlogPost, SearchListing, SearchResult } from "@/types/search";

export const dynamic = "force-dynamic";

// Search is an interactive surface — no reason to index the empty-query
// page or any `?q=…` permutation in search engines. robots.noindex
// keeps the search results out of Google's SERPs (and out of our own
// sitemap, which already excludes /search).
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
  alternates: { canonical: "/search" }
};

const PAGE_LIMIT = 30;

const KIND_BADGE: Record<"listing" | "blog", string> = {
  listing: "bg-slate-100 text-slate-700",
  blog: "bg-stone-200 text-stone-700"
};

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const results: SearchResult[] = q
    ? await searchPublic(q, { limit: PAGE_LIMIT }).catch(() => [])
    : [];

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-display text-3xl sm:text-4xl leading-tight">
        Search
      </h1>

      {/* Plain GET form — submits to /search?q=... with the typed value.
          Full page navigation on submit; server re-renders with the new
          query. No client-side autocomplete in v1; keeps the page
          shape simple and crawler-proof. */}
      <form method="GET" action="/search" className="mt-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Search listings and blog…"
          aria-label="Search query"
          className="flex-1 border border-black/20 bg-white px-4 py-3 text-base focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="bg-ink text-paper px-5 py-3 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {!q ? (
          <p className="text-black/55">
            Type a query above to search published listings and blog posts.
          </p>
        ) : results.length === 0 ? (
          <div className="border border-dashed border-black/15 py-16 text-center text-black/55">
            <p>No matches for <span className="font-medium">{q}</span>.</p>
            <p className="text-xs mt-2">
              Full-text search needs complete words. Try a shorter or more
              general query.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-black/50 mb-4">
              {results.length} result{results.length === 1 ? "" : "s"} for{" "}
              <span className="text-ink">{q}</span>
            </p>
            <ul className="divide-y divide-black/10 border border-black/10 bg-white">
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  {r.kind === "listing" ? (
                    <ListingResult result={r} />
                  ) : (
                    <BlogResult result={r} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}

function ListingResult({ result }: { result: SearchListing }) {
  // Sale listings land on /listings/{slug}, rentals on /rentals/{slug}.
  const href =
    result.listingType === "rental"
      ? `/rentals/${result.slug}`
      : `/listings/${result.slug}`;
  const sold = result.soldAt !== null;

  return (
    <Link
      href={href}
      className="flex gap-4 p-4 hover:bg-black/[0.02] transition-colors"
    >
      {/* Thumbnail — plain <img> not next/image, because hero URLs can
          come from any historical source (same reasoning as the blog
          index card's first cut). Small + lazy-loaded so perf cost is
          minimal either way. */}
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-black/5 flex-shrink-0 overflow-hidden">
        {result.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.heroImageUrl}
            alt={result.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-black/40">
            No photo
          </div>
        )}
        {sold && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5">
            Sold
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={"text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + KIND_BADGE.listing}>
            {result.listingType === "rental" ? "Rental" : "Listing"}
          </span>
        </div>
        <h2 className="font-display text-xl mt-1 leading-tight truncate">
          {result.title}
        </h2>
        <p className="text-sm text-black/60">{result.location}</p>
        {result.snippet && (
          <p className="text-sm text-black/55 mt-2 line-clamp-2">
            {result.snippet}
          </p>
        )}
      </div>
    </Link>
  );
}

function BlogResult({ result }: { result: SearchBlogPost }) {
  return (
    <Link
      href={`/blog/${result.slug}`}
      className="flex gap-4 p-4 hover:bg-black/[0.02] transition-colors"
    >
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-black/5 flex-shrink-0 overflow-hidden">
        {result.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.coverImageUrl}
            alt={result.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-black/40">
            No photo
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={"text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + KIND_BADGE.blog}>
            Blog
          </span>
          <span className="text-[10px] uppercase tracking-widest text-black/50">
            {result.categorySlug}
          </span>
        </div>
        <h2 className="font-display text-xl mt-1 leading-tight truncate">
          {result.title}
        </h2>
        {result.excerpt && (
          <p className="text-sm text-black/60 line-clamp-1">{result.excerpt}</p>
        )}
        {result.snippet && (
          <p className="text-sm text-black/55 mt-2 line-clamp-2">
            {result.snippet}
          </p>
        )}
      </div>
    </Link>
  );
}
