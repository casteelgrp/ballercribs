import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import {
  countAgentInquiriesByArchiveStatus,
  countInquiriesByArchiveStatus,
  countListingsByStatus,
  getRecentAgentInquiries,
  getRecentInquiries
} from "@/lib/db";
import { isOwner } from "@/lib/permissions";
import type { ListingStatus, User } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const [counts, inquiryCounts, agentInquiryCounts, recentInquiries, recentAgentInquiries] =
    await Promise.all([
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
        ? getRecentInquiries({ archived: false, limit: 3 }).catch(() => [])
        : Promise.resolve([]),
      isOwner(user)
        ? getRecentAgentInquiries({ archived: false, limit: 3 }).catch(() => [])
        : Promise.resolve([])
    ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {isOwner(user) && (
          <>
            <StatCard
              label="New inquiries"
              value={inquiryCounts.active}
              href="/admin/inquiries"
            />
            <StatCard
              label="Agent inquiries"
              value={agentInquiryCounts.active}
              href="/admin/inquiries#agents"
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
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-xl">Recent buyer inquiries</h3>
              <Link
                href="/admin/inquiries"
                className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
              >
                See all →
              </Link>
            </div>
            {recentInquiries.length === 0 ? (
              <p className="text-sm text-black/50">No inquiries yet.</p>
            ) : (
              <div className="border border-black/10 bg-white divide-y divide-black/10">
                {recentInquiries.map((i) => (
                  <Link
                    key={i.id}
                    href="/admin/inquiries"
                    className="block p-4 hover:bg-black/5 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium truncate">{i.name}</p>
                      <p className="text-xs text-black/50 shrink-0">
                        {new Date(i.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {i.listing_title && (
                      <p className="text-sm text-black/60 truncate mt-0.5">
                        Re: {i.listing_title}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-xl">Recent agent inquiries</h3>
              <Link
                href="/admin/inquiries#agents"
                className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
              >
                See all →
              </Link>
            </div>
            {recentAgentInquiries.length === 0 ? (
              <p className="text-sm text-black/50">No agent inquiries yet.</p>
            ) : (
              <div className="border border-black/10 bg-white divide-y divide-black/10">
                {recentAgentInquiries.map((a) => (
                  <Link
                    key={a.id}
                    href="/admin/inquiries#agents"
                    className="block p-4 hover:bg-black/5 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium truncate">{a.name}</p>
                      <p className="text-xs text-black/50 shrink-0">
                        {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm text-black/60 mt-0.5 capitalize">
                      {a.inquiry_type}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
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
