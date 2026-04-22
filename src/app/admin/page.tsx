import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import {
  countAgentInquiriesByArchiveStatus,
  countInquiriesByArchiveStatus,
  countListingsByStatus,
  countRentalInquiriesByArchiveStatus,
  getRecentAgentInquiries,
  getRecentInquiries,
  getRecentRentalInquiries
} from "@/lib/db";
import { isOwner } from "@/lib/permissions";
import { formatRelativeShort } from "@/lib/format";
import type {
  AgentInquiry,
  Inquiry,
  ListingStatus,
  RentalInquiry,
  User
} from "@/lib/types";

export const dynamic = "force-dynamic";

// Type + status tokens mirror the unified inquiry inbox so the dashboard
// feels like a preview of the same table, not a separate widget.
const TYPE_BADGE: Record<"buyer" | "agent" | "rental", string> = {
  buyer: "bg-slate-100 text-slate-700",
  agent: "bg-indigo-100 text-indigo-700",
  rental: "bg-emerald-100 text-emerald-700"
};
const TYPE_LABEL: Record<"buyer" | "agent" | "rental", string> = {
  buyer: "Buyer",
  agent: "Agent",
  rental: "Rental"
};

type BuyerRecent = Inquiry & { listing_title: string | null; listing_slug: string | null };
type RecentRow =
  | (BuyerRecent & { kind: "buyer" })
  | (AgentInquiry & { kind: "agent" })
  | (RentalInquiry & { kind: "rental" });

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
  const scopeUserId = isOwner(user) ? undefined : user.id;

  const [
    counts,
    inquiryCounts,
    agentInquiryCounts,
    rentalInquiryCounts,
    recentBuyer,
    recentAgent,
    recentRental
  ] = await Promise.all([
    countListingsByStatus(scopeUserId).catch(
      (): Record<ListingStatus, number> => ({
        draft: 0,
        review: 0,
        published: 0,
        archived: 0
      })
    ),
    isOwner(user)
      ? countInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 }))
      : Promise.resolve({ active: 0, archived: 0 }),
    isOwner(user)
      ? countAgentInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 }))
      : Promise.resolve({ active: 0, archived: 0 }),
    isOwner(user)
      ? countRentalInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 }))
      : Promise.resolve({ active: 0, archived: 0 }),
    // Over-fetch each kind (6) so the merged + sorted top-6 has enough
    // candidates. Anything beyond that lives in the full inbox anyway.
    isOwner(user)
      ? getRecentInquiries({ archived: false, limit: 6 }).catch(() => [])
      : Promise.resolve([]),
    isOwner(user)
      ? getRecentAgentInquiries({ archived: false, limit: 6 }).catch(() => [])
      : Promise.resolve([]),
    isOwner(user)
      ? getRecentRentalInquiries({ archived: false, limit: 6 }).catch(() => [])
      : Promise.resolve([])
  ]);

  const recentMixed: RecentRow[] = mergeRecent(
    recentBuyer,
    recentAgent,
    recentRental
  ).slice(0, 6);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <section
        className={
          isOwner(user)
            ? "grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10"
            : "grid grid-cols-2 gap-4 mb-10"
        }
      >
        {isOwner(user) && (
          <>
            <StatCard
              label="Buyer inquiries"
              value={inquiryCounts.active}
              href="/admin/inquiries?type=buyer"
            />
            <StatCard
              label="Agent inquiries"
              value={agentInquiryCounts.active}
              href="/admin/inquiries?type=agent"
            />
            <StatCard
              label="Rental inquiries"
              value={rentalInquiryCounts.active}
              href="/admin/inquiries?type=rental"
            />
          </>
        )}
        <StatCard
          label="Listings in review"
          value={counts.review}
          href="/admin/listings?status=review"
        />
        <StatCard
          label="Published listings"
          value={counts.published}
          href="/admin/listings?status=published"
        />
      </section>

      <section className="flex flex-wrap gap-3 mb-12">
        <Link
          href="/admin/listings/new"
          className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
        >
          New Listing →
        </Link>
        {isOwner(user) && (
          <Link
            href="/admin/inquiries"
            className="border border-ink text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
          >
            View Inquiries →
          </Link>
        )}
      </section>

      {isOwner(user) && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-xl">Recent inquiries</h3>
            <Link
              href="/admin/inquiries"
              className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
            >
              See all →
            </Link>
          </div>
          {recentMixed.length === 0 ? (
            <p className="text-sm text-black/50">No inquiries yet.</p>
          ) : (
            <div className="border border-black/10 bg-white divide-y divide-black/10">
              {recentMixed.map((row) => (
                <Link
                  key={`${row.kind}-${row.id}`}
                  href={`/admin/inquiries?type=${row.kind}`}
                  className="flex items-baseline justify-between gap-3 p-4 hover:bg-black/[0.02] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                          TYPE_BADGE[row.kind]
                        }
                      >
                        {TYPE_LABEL[row.kind]}
                      </span>
                      <p className="font-medium truncate">{row.name}</p>
                    </div>
                    <p className="text-xs text-black/55 mt-0.5 truncate">
                      {subtitleFor(row)}
                    </p>
                  </div>
                  <p className="text-xs text-black/50 shrink-0 whitespace-nowrap">
                    {formatRelativeShort(row.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function mergeRecent(
  buyer: BuyerRecent[],
  agent: AgentInquiry[],
  rental: RentalInquiry[]
): RecentRow[] {
  const tagged: RecentRow[] = [
    ...buyer.map((b) => ({ ...b, kind: "buyer" as const })),
    ...agent.map((a) => ({ ...a, kind: "agent" as const })),
    ...rental.map((r) => ({ ...r, kind: "rental" as const }))
  ];
  tagged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return tagged;
}

function subtitleFor(row: RecentRow): string {
  if (row.kind === "buyer") {
    return row.listing_title ? `Re: ${row.listing_title}` : row.email;
  }
  if (row.kind === "rental") {
    return `Rental — ${row.destination}`;
  }
  return row.brokerage || row.city_state || row.email;
}

function StatCard({
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
      className="border border-black/10 bg-white p-5 hover:border-accent hover:bg-accent/5 transition-colors"
    >
      <p className="text-xs uppercase tracking-widest text-black/50">{label}</p>
      <p className="font-display text-3xl mt-2">{value}</p>
    </Link>
  );
}
