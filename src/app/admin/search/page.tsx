import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { searchAdmin } from "@/lib/search";
import type { SearchBlogPost, SearchListing } from "@/types/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search — BallerCribs" };

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

const PAGE_LIMIT = 25;

export default async function AdminSearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const results = q
    ? await searchAdmin(q, { limit: PAGE_LIMIT }).catch(() => ({
        listings: [],
        blogs: []
      }))
    : { listings: [], blogs: [] };

  const total = results.listings.length + results.blogs.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-6">
        <h2 className="font-display text-2xl">Search</h2>
        <p className="text-sm text-black/60 mt-1">
          {q ? (
            <>
              {total} match{total === 1 ? "" : "es"} for{" "}
              <span className="font-medium">{q}</span>
            </>
          ) : (
            "Type in the top bar to search listings and blog posts."
          )}
        </p>
      </div>

      {q && total === 0 && (
        <div className="border border-dashed border-black/15 py-20 text-center text-black/50">
          <p>No matches.</p>
          <p className="text-xs mt-2">
            Try a shorter or more general query — full-text search needs
            complete words (partial matches aren&apos;t supported yet).
          </p>
        </div>
      )}

      {results.listings.length > 0 && (
        <section className="mb-10">
          <h3 className="font-display text-xl mb-4">
            Listings{" "}
            <span className="text-black/40 text-base">
              ({results.listings.length})
            </span>
          </h3>
          <ul className="divide-y divide-black/10 border border-black/10 bg-white">
            {results.listings.map((r) => (
              <li key={`l-${r.id}`}>
                <ListingRow result={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.blogs.length > 0 && (
        <section>
          <h3 className="font-display text-xl mb-4">
            Blog posts{" "}
            <span className="text-black/40 text-base">
              ({results.blogs.length})
            </span>
          </h3>
          <ul className="divide-y divide-black/10 border border-black/10 bg-white">
            {results.blogs.map((r) => (
              <li key={`b-${r.id}`}>
                <BlogRow result={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ListingRow({ result }: { result: SearchListing }) {
  return (
    <Link
      href={`/admin/listings/${result.id}/edit`}
      className="block px-4 py-3 hover:bg-black/[0.02] transition-colors"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium truncate flex-1 min-w-0">
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
        <p className="text-sm text-black/60 mt-1 line-clamp-2">
          {result.snippet}
        </p>
      )}
      <p className="text-[10px] uppercase tracking-widest text-black/40 mt-1">
        {result.location}
      </p>
    </Link>
  );
}

function BlogRow({ result }: { result: SearchBlogPost }) {
  return (
    <Link
      href={`/admin/blog/${result.id}/edit`}
      className="block px-4 py-3 hover:bg-black/[0.02] transition-colors"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium truncate flex-1 min-w-0">
          {result.title}
        </span>
        <Badge className="bg-black/5 text-black/60">
          {result.categorySlug}
        </Badge>
        <Badge className={STATUS_BADGE[result.status] ?? STATUS_BADGE.draft}>
          {result.status}
        </Badge>
      </div>
      {result.snippet && (
        <p className="text-sm text-black/60 mt-1 line-clamp-2">
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
        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + className
      }
    >
      {children}
    </span>
  );
}
