import Link from "next/link";
import type { Metadata } from "next";
import {
  countPublishedListingsBySoldState,
  getListings,
  type PublicListingStatusFilter
} from "@/lib/db";
import { ListingCard } from "@/components/ListingCard";
import { ForAgentsBand } from "@/components/ForAgentsBand";

const VALID_STATUSES: PublicListingStatusFilter[] = ["active", "sold", "all"];

// Titles rely on the root-layout template `%s | BallerCribs` so none of
// these include the brand suffix directly.
const TITLES: Record<PublicListingStatusFilter, string> = {
  active: "Listings — Luxury homes, estates & architecture",
  sold: "Sold — Recently closed luxury homes",
  all: "All listings — Active and sold"
};

const DESCRIPTIONS: Record<PublicListingStatusFilter, string> = {
  active: "Browse the wildest luxury homes on the internet. New listings every week.",
  sold: "Recently sold luxury homes featured on BallerCribs.",
  all: "All luxury listings featured on BallerCribs — active and sold."
};

const TAB_LABEL: Record<PublicListingStatusFilter, string> = {
  active: "Active",
  sold: "Sold",
  all: "All"
};

function resolveStatus(raw: string | undefined): PublicListingStatusFilter {
  if (raw && (VALID_STATUSES as string[]).includes(raw)) {
    return raw as PublicListingStatusFilter;
  }
  return "active";
}

// Shared across every status view — the per-status titles handle
// pipeline state (active / sold / all); the body + card treatment stay
// constant so a share of /listings or /listings?status=sold both read
// as "the listings catalog," not two different products.
const OG_DESCRIPTION =
  "Curated mega-mansions, architectural icons, and estates across the US and beyond. Direct lines to the listing agents.";
const OG_TITLE = "Luxury Listings";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}): Promise<Metadata> {
  const { status: rawStatus } = await searchParams;
  const status = resolveStatus(rawStatus);
  // Canonical drops the query-string on the default (active) view so crawlers
  // don't treat /listings and /listings?status=active as separate pages.
  const canonical = status === "active" ? "/listings" : `/listings?status=${status}`;
  return {
    title: TITLES[status],
    description: DESCRIPTIONS[status],
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: OG_TITLE,
      description: OG_DESCRIPTION
    },
    twitter: {
      card: "summary_large_image",
      title: OG_TITLE,
      description: OG_DESCRIPTION
    }
  };
}

export default async function ListingsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = resolveStatus(rawStatus);

  const [listings, counts] = await Promise.all([
    getListings(status).catch(() => []),
    countPublishedListingsBySoldState().catch(() => ({ active: 0, sold: 0, all: 0 }))
  ]);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header — solo "For agents →" link right-aligned against the
            stacked eyebrow/h1/description block. flex-wrap drops it
            under on narrow viewports; mt-2 sm:mt-3 roughly aligns the
            link baseline with the h1 row instead of hanging from the
            eyebrow. */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-black/50">All properties</p>
            <h1 className="font-display text-4xl sm:text-5xl mt-2">Listings</h1>
            <p className="text-black/60 mt-3 max-w-2xl">
              Every home featured on @ballercribs, curated from the world's top luxury markets.
            </p>
          </div>
          <Link
            href="/agents"
            className="text-sm hover:text-accent underline underline-offset-4 mt-2 sm:mt-3"
          >
            For agents →
          </Link>
        </div>

        <StatusTabs current={status} counts={counts} />

        {listings.length === 0 ? (
          <div className="border border-dashed border-black/20 py-24 text-center text-black/50 mt-6">
            <p>{emptyStateFor(status)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {/* Full-bleed For Agents band at the bottom of the catalog. Moved
          here from the homepage in D6 — /listings visitors scrolling the
          feed include agents evaluating fit at a higher rate than home-
          page casual scrollers. Rendered outside the max-w-7xl container
          so the ink stretches edge-to-edge. */}
      <ForAgentsBand />
    </>
  );
}

function emptyStateFor(status: PublicListingStatusFilter): string {
  if (status === "active")
    return "No active listings right now. Check back soon — we publish new features weekly.";
  if (status === "sold") return "No sold listings yet. Check back as properties close.";
  return "No listings yet.";
}

/**
 * Segmented control styled to match the admin archive/active toggle — small
 * ink-on-paper pills, URL-driven so the filter survives bookmarks and the
 * back button. Shared through to generateMetadata via the `status` param.
 */
function StatusTabs({
  current,
  counts
}: {
  current: PublicListingStatusFilter;
  counts: { active: number; sold: number; all: number };
}) {
  const base = "px-3 py-1 text-xs uppercase tracking-widest border transition-colors";
  const activeCls = "bg-ink text-paper border-ink";
  const idleCls = "border-black/20 text-black/60 hover:border-black/50";
  return (
    <div className="flex gap-0 isolate" role="tablist" aria-label="Listings filter">
      {VALID_STATUSES.map((tab, i) => {
        const selected = tab === current;
        // Active tab == default route → link to bare /listings so the URL stays clean.
        const href = tab === "active" ? "/listings" : `/listings?status=${tab}`;
        return (
          <Link
            key={tab}
            href={href}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={
              base + (i > 0 ? " -ml-px" : "") + " " + (selected ? activeCls : idleCls)
            }
          >
            {TAB_LABEL[tab]} ({counts[tab]})
          </Link>
        );
      })}
    </div>
  );
}
