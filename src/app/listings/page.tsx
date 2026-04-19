import Link from "next/link";
import type { Metadata } from "next";
import {
  countPublishedListingsBySoldState,
  getListings,
  type PublicListingStatusFilter
} from "@/lib/db";
import { ListingCard } from "@/components/ListingCard";

const VALID_STATUSES: PublicListingStatusFilter[] = ["active", "sold", "all"];

const TITLES: Record<PublicListingStatusFilter, string> = {
  active: "Luxury listings for sale — BallerCribs",
  sold: "Recently sold luxury homes — BallerCribs",
  all: "All luxury listings — BallerCribs"
};

const DESCRIPTIONS: Record<PublicListingStatusFilter, string> = {
  active: "Curated luxury mega-mansions and architectural estates currently for sale.",
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

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}): Promise<Metadata> {
  const { status: rawStatus } = await searchParams;
  const status = resolveStatus(rawStatus);
  return {
    title: TITLES[status],
    description: DESCRIPTIONS[status]
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-black/50">All properties</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Listings</h1>
        <p className="text-black/60 mt-3 max-w-2xl">
          Every home featured on @ballercribs, curated from the world's top luxury markets.
        </p>
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
