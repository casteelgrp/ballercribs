import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import {
  countAgentInquiriesByArchiveStatus,
  countInquiriesByArchiveStatus,
  countListingsByStatus,
  countPublishedRentalListings,
  countRentalInquiriesByArchiveStatus,
  getAdminListingsWithCreators,
  getRecentAgentInquiries,
  getRecentInquiries,
  getRecentRentalInquiries
} from "@/lib/db";
import {
  getAdminPostCounts,
  getAllPostsForAdmin,
  getPublishedPosts
} from "@/lib/blog-queries";
import { isOwner } from "@/lib/permissions";
import { formatRelativeShort } from "@/lib/format";
import type {
  AgentInquiry,
  Inquiry,
  Listing,
  ListingStatus,
  RentalInquiry,
  User
} from "@/lib/types";
import type { BlogPostListItem } from "@/types/blog";

export const dynamic = "force-dynamic";

type BuyerRecent = Inquiry & { listing_title: string | null; listing_slug: string | null };

// One badge tone per kind — matches the inbox page's type pills so the
// dashboard reads as a preview of the same data, not a parallel widget.
const KIND_BADGE: Record<ActivityKind, string> = {
  "inquiry-buyer": "bg-slate-100 text-slate-700",
  "inquiry-agent": "bg-indigo-100 text-indigo-700",
  "inquiry-rental": "bg-emerald-100 text-emerald-700",
  publication: "bg-amber-100 text-amber-800"
};
const KIND_LABEL: Record<ActivityKind, string> = {
  "inquiry-buyer": "Buyer",
  "inquiry-agent": "Agent",
  "inquiry-rental": "Rental",
  publication: "Published"
};

type ActivityKind =
  | "inquiry-buyer"
  | "inquiry-agent"
  | "inquiry-rental"
  | "publication";

interface ActivityRow {
  key: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  href: string;
  at: string;
}

function pageTitleFor(user: User): string {
  return isOwner(user) ? "Dashboard" : "Listing Dashboard";
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const user = await requirePageUser();
    return { title: `${pageTitleFor(user)} — BallerCribs` };
  } catch {
    return { title: "Dashboard — BallerCribs" };
  }
}

export default async function AdminDashboardPage() {
  const user = await requirePageUser();
  const owner = isOwner(user);
  const scopeUserId = owner ? undefined : user.id;

  // One Promise.all so the page paints after the slowest read, not after
  // ten sequential round-trips. Non-owner paths resolve synchronously to
  // empty shapes so the shared fetch graph stays flat.
  const empty = { active: 0, archived: 0 };
  const emptyListingCounts: Record<ListingStatus, number> = {
    draft: 0,
    review: 0,
    published: 0,
    archived: 0
  };

  const [
    listingCounts,
    buyerCounts,
    agentCounts,
    rentalCounts,
    rentalListingCount,
    postCounts,
    listingsInReview,
    draftPosts,
    newBuyerInquiries,
    newAgentInquiries,
    newRentalInquiries,
    recentBuyer,
    recentAgent,
    recentRental,
    recentPublishedListings,
    recentPublishedPosts
  ] = await Promise.all([
    countListingsByStatus(scopeUserId).catch(() => emptyListingCounts),
    owner
      ? countInquiriesByArchiveStatus().catch(() => empty)
      : Promise.resolve(empty),
    owner
      ? countAgentInquiriesByArchiveStatus().catch(() => empty)
      : Promise.resolve(empty),
    owner
      ? countRentalInquiriesByArchiveStatus().catch(() => empty)
      : Promise.resolve(empty),
    owner ? countPublishedRentalListings().catch(() => 0) : Promise.resolve(0),
    owner
      ? getAdminPostCounts().catch(() => ({
          all: 0,
          draft: 0,
          review: 0,
          published: 0,
          archived: 0
        }))
      : Promise.resolve({ all: 0, draft: 0, review: 0, published: 0, archived: 0 }),
    getAdminListingsWithCreators("review", scopeUserId).catch(
      (): (Listing & { creator_name: string | null })[] => []
    ),
    owner
      ? getAllPostsForAdmin({ status: "draft" }).catch(
          (): BlogPostListItem[] => []
        )
      : Promise.resolve([] as BlogPostListItem[]),
    owner
      ? getRecentInquiries({ status: "new", limit: 6 }).catch(
          (): BuyerRecent[] => []
        )
      : Promise.resolve([] as BuyerRecent[]),
    owner
      ? getRecentAgentInquiries({ status: "new", limit: 6 }).catch(
          (): AgentInquiry[] => []
        )
      : Promise.resolve([] as AgentInquiry[]),
    owner
      ? getRecentRentalInquiries({ status: "new", limit: 6 }).catch(
          (): RentalInquiry[] => []
        )
      : Promise.resolve([] as RentalInquiry[]),
    owner
      ? getRecentInquiries({ archived: false, limit: 6 }).catch(
          (): BuyerRecent[] => []
        )
      : Promise.resolve([] as BuyerRecent[]),
    owner
      ? getRecentAgentInquiries({ archived: false, limit: 6 }).catch(
          (): AgentInquiry[] => []
        )
      : Promise.resolve([] as AgentInquiry[]),
    owner
      ? getRecentRentalInquiries({ archived: false, limit: 6 }).catch(
          (): RentalInquiry[] => []
        )
      : Promise.resolve([] as RentalInquiry[]),
    getAdminListingsWithCreators("published", scopeUserId).catch(
      (): (Listing & { creator_name: string | null })[] => []
    ),
    owner
      ? getPublishedPosts({ limit: 6 }).catch((): BlogPostListItem[] => [])
      : Promise.resolve([] as BlogPostListItem[])
  ]);

  const totalInquiries =
    buyerCounts.active +
    buyerCounts.archived +
    agentCounts.active +
    agentCounts.archived +
    rentalCounts.active +
    rentalCounts.archived;

  const needsAttention = buildNeedsAttention({
    listingsInReview,
    draftPosts,
    newBuyerInquiries,
    newAgentInquiries,
    newRentalInquiries,
    owner
  });

  const activity = buildActivityFeed({
    recentBuyer,
    recentAgent,
    recentRental,
    recentPublishedListings,
    recentPublishedPosts
  }).slice(0, 10);

  const allCaughtUp = needsAttention.every((section) => section.items.length === 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column — needs-attention queues. Wider because the rows
            are link lists; the right column holds compressed stats. */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Needs attention</h2>
          </div>

          {allCaughtUp ? (
            <div className="border border-black/10 bg-white p-8 text-center">
              <p className="font-display text-xl">All caught up.</p>
              <p className="text-sm text-black/55 mt-1">
                Nothing in the queues right now.
              </p>
            </div>
          ) : (
            needsAttention.map((section) =>
              section.items.length === 0 ? null : (
                <NeedsAttentionSection key={section.heading} section={section} />
              )
            )
          )}
        </div>

        {/* Right column — at-a-glance stats + quick actions. Each stat
            row compresses to label + value + link so five of them stack
            cleanly in the narrow col-span-1 gutter. */}
        <aside className="space-y-8">
          <section>
            <h2 className="font-display text-2xl mb-4">At a glance</h2>
            <div className="border border-black/10 bg-white divide-y divide-black/10">
              <StatRow
                label="Published listings"
                value={listingCounts.published}
                href="/admin/listings?status=published"
              />
              {owner && (
                <StatRow
                  label="Published blog posts"
                  value={postCounts.published}
                  href="/admin/blog?status=published"
                />
              )}
              {owner && (
                <StatRow
                  label="Published rentals"
                  value={rentalListingCount}
                  href="/admin/listings?status=published&type=rental"
                />
              )}
              {owner && (
                <StatRow
                  label="Total inquiries"
                  value={totalInquiries}
                  href="/admin/inquiries"
                />
              )}
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl mb-4">Quick actions</h2>
            <div className="flex flex-col gap-2">
              <Link
                href="/admin/listings/new"
                className="bg-ink text-paper px-5 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors text-center"
              >
                New listing
              </Link>
              {owner && (
                <Link
                  href="/admin/blog/new"
                  className="border border-ink text-ink px-5 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors text-center"
                >
                  New blog post
                </Link>
              )}
              {owner && (
                <Link
                  href="/admin/inquiries"
                  className="border border-ink text-ink px-5 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors text-center"
                >
                  View all inquiries
                </Link>
              )}
              {owner && (
                <Link
                  href="/admin/hero-photos"
                  className="border border-ink text-ink px-5 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors text-center"
                >
                  Manage hero photos
                </Link>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Full-width recent activity feed below both columns. Mixes
          inquiries + publications on a single timeline so the dashboard
          feels like a diary of what happened, not a set of siloed
          lists. Capped at 10 — full history lives in the per-surface
          admin indexes. */}
      {owner && activity.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl mb-4">Recent activity</h2>
          <div className="border border-black/10 bg-white divide-y divide-black/10">
            {activity.map((row) => (
              <Link
                key={row.key}
                href={row.href}
                className="flex items-baseline justify-between gap-3 p-4 hover:bg-black/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                        KIND_BADGE[row.kind]
                      }
                    >
                      {KIND_LABEL[row.kind]}
                    </span>
                    <p className="font-medium truncate">{row.title}</p>
                  </div>
                  <p className="text-xs text-black/55 mt-0.5 truncate">
                    {row.subtitle}
                  </p>
                </div>
                <p className="text-xs text-black/50 shrink-0 whitespace-nowrap">
                  {formatRelativeShort(row.at)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Needs-attention assembly ─────────────────────────────────────────────

interface NeedsAttentionItem {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  at: string | null;
}

interface NeedsAttentionSection {
  heading: string;
  /** Total items available (for "See all N →" count). */
  total: number;
  /** Up to 5 items to render inline. */
  items: NeedsAttentionItem[];
  seeAllHref: string;
}

function buildNeedsAttention(args: {
  listingsInReview: (Listing & { creator_name: string | null })[];
  draftPosts: BlogPostListItem[];
  newBuyerInquiries: BuyerRecent[];
  newAgentInquiries: AgentInquiry[];
  newRentalInquiries: RentalInquiry[];
  owner: boolean;
}): NeedsAttentionSection[] {
  const sections: NeedsAttentionSection[] = [];

  sections.push({
    heading: "Listings in review",
    total: args.listingsInReview.length,
    seeAllHref: "/admin/listings?status=review",
    items: args.listingsInReview.slice(0, 5).map((l) => ({
      key: `review-${l.id}`,
      title: l.title,
      subtitle:
        (l.creator_name ? `By ${l.creator_name}` : "") +
        (l.location ? (l.creator_name ? ` · ${l.location}` : l.location) : ""),
      href: `/admin/listings/${l.id}/edit`,
      at: l.submitted_at ?? l.updated_at
    }))
  });

  if (args.owner) {
    sections.push({
      heading: "Unread buyer inquiries",
      total: args.newBuyerInquiries.length,
      seeAllHref: "/admin/inquiries?type=buyer&status=new",
      items: args.newBuyerInquiries.slice(0, 5).map((i) => ({
        key: `buyer-${i.id}`,
        title: i.name,
        subtitle: i.listing_title ? `Re: ${i.listing_title}` : i.email,
        href: `/admin/inquiries?type=buyer&status=new`,
        at: i.created_at
      }))
    });

    sections.push({
      heading: "Unread agent inquiries",
      total: args.newAgentInquiries.length,
      seeAllHref: "/admin/inquiries?type=agent&status=new",
      items: args.newAgentInquiries.slice(0, 5).map((a) => ({
        key: `agent-${a.id}`,
        title: a.name,
        subtitle: a.brokerage || a.city_state || a.email,
        href: `/admin/inquiries?type=agent&status=new`,
        at: a.created_at
      }))
    });

    sections.push({
      heading: "Unread rental inquiries",
      total: args.newRentalInquiries.length,
      seeAllHref: "/admin/inquiries?type=rental&status=new",
      items: args.newRentalInquiries.slice(0, 5).map((r) => ({
        key: `rental-${r.id}`,
        title: r.name,
        subtitle: `${r.destination} · ${r.email}`,
        href: `/admin/inquiries?type=rental&status=new`,
        at: r.created_at
      }))
    });

    sections.push({
      heading: "Blog posts in draft",
      total: args.draftPosts.length,
      seeAllHref: "/admin/blog?status=draft",
      items: args.draftPosts.slice(0, 5).map((p) => ({
        key: `draft-${p.id}`,
        title: p.title,
        subtitle: p.categorySlug,
        href: `/admin/blog/${p.id}/edit`,
        at: null
      }))
    });
  }

  return sections;
}

function NeedsAttentionSection({ section }: { section: NeedsAttentionSection }) {
  const overflow = section.total > section.items.length;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display text-lg">
          {section.heading}{" "}
          <span className="text-sm text-black/50 font-sans">({section.total})</span>
        </h3>
        {overflow && (
          <Link
            href={section.seeAllHref}
            className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
          >
            See all {section.total} →
          </Link>
        )}
      </div>
      <div className="border border-black/10 bg-white divide-y divide-black/10">
        {section.items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-baseline justify-between gap-3 p-4 hover:bg-black/[0.02] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{item.title}</p>
              {item.subtitle && (
                <p className="text-xs text-black/55 mt-0.5 truncate">{item.subtitle}</p>
              )}
            </div>
            {item.at && (
              <p className="text-xs text-black/50 shrink-0 whitespace-nowrap">
                {formatRelativeShort(item.at)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Activity feed assembly ───────────────────────────────────────────────

function buildActivityFeed(args: {
  recentBuyer: BuyerRecent[];
  recentAgent: AgentInquiry[];
  recentRental: RentalInquiry[];
  recentPublishedListings: (Listing & { creator_name: string | null })[];
  recentPublishedPosts: BlogPostListItem[];
}): ActivityRow[] {
  const rows: ActivityRow[] = [
    ...args.recentBuyer.map<ActivityRow>((i) => ({
      key: `ab-${i.id}`,
      kind: "inquiry-buyer",
      title: i.name,
      subtitle: i.listing_title ? `Re: ${i.listing_title}` : i.email,
      href: `/admin/inquiries?type=buyer`,
      at: i.created_at
    })),
    ...args.recentAgent.map<ActivityRow>((a) => ({
      key: `aa-${a.id}`,
      kind: "inquiry-agent",
      title: a.name,
      subtitle: a.brokerage || a.city_state || a.email,
      href: `/admin/inquiries?type=agent`,
      at: a.created_at
    })),
    ...args.recentRental.map<ActivityRow>((r) => ({
      key: `ar-${r.id}`,
      kind: "inquiry-rental",
      title: r.name,
      subtitle: `Rental — ${r.destination}`,
      href: `/admin/inquiries?type=rental`,
      at: r.created_at
    })),
    ...args.recentPublishedListings
      .filter((l) => l.published_at !== null)
      .slice(0, 10)
      .map<ActivityRow>((l) => ({
        key: `pl-${l.id}`,
        kind: "publication",
        title: l.title,
        subtitle: l.listing_type === "rental" ? "Rental listing" : "Listing",
        href: `/admin/listings/${l.id}/edit`,
        at: l.published_at as string
      })),
    ...args.recentPublishedPosts
      .filter((p) => p.publishedAt !== null)
      .map<ActivityRow>((p) => ({
        key: `pp-${p.id}`,
        kind: "publication",
        title: p.title,
        subtitle: "Blog post",
        href: `/admin/blog/${p.id}/edit`,
        at: (p.publishedAt as Date).toISOString()
      }))
  ];
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows;
}

// ─── Primitives ───────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  href
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-baseline justify-between p-4 hover:bg-accent/5 transition-colors"
    >
      <span className="text-xs uppercase tracking-widest text-black/55">{label}</span>
      <span className="font-display text-2xl">{value}</span>
    </Link>
  );
}
