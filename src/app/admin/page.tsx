import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import {
  countListingsByStatus,
  getAdminListingsWithCreators,
  getRecentInquiries,
  type AdminListingFilter
} from "@/lib/db";
import { ListingForm } from "@/components/ListingForm";
import { ListingActions } from "@/components/ListingActions";
import { defaultAdminTab } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";
import type { ListingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TAB_ORDER: AdminListingFilter[] = ["all", "draft", "review", "published", "archived"];
const TAB_LABEL: Record<AdminListingFilter, string> = {
  all: "All",
  draft: "Draft",
  review: "Review",
  published: "Published",
  archived: "Archived"
};

const STATUS_BADGE: Record<ListingStatus, string> = {
  draft: "bg-black/10 text-black/70",
  review: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-black/5 text-black/40"
};

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; tab?: string }>;
}) {
  const user = await requirePageUser();
  const sp = await searchParams;

  const requested = (sp.status as AdminListingFilter | undefined) ?? defaultAdminTab(user);
  const currentTab: AdminListingFilter = TAB_ORDER.includes(requested as AdminListingFilter)
    ? (requested as AdminListingFilter)
    : "all";

  const [listings, counts, inquiries] = await Promise.all([
    getAdminListingsWithCreators(currentTab).catch(() => []),
    countListingsByStatus().catch(
      (): Record<ListingStatus, number> => ({
        draft: 0,
        review: 0,
        published: 0,
        archived: 0
      })
    ),
    getRecentInquiries(50).catch(() => [])
  ]);

  const allCount = counts.draft + counts.review + counts.published; // 'All' hides archived

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Admin</h1>
          <p className="text-sm text-black/60 mt-1">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/admin/account" className="underline underline-offset-4 hover:text-accent">
            Account
          </Link>
          {user.role === "owner" && (
            <Link href="/admin/users" className="underline underline-offset-4 hover:text-accent">
              Users
            </Link>
          )}
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className="underline underline-offset-4 hover:text-accent">
              Sign out
            </button>
          </form>
        </nav>
      </div>

      {/* New listing */}
      <section className="mb-16">
        <h2 className="font-display text-2xl mb-1">New listing</h2>
        <p className="text-sm text-black/60 mb-6">
          {user.role === "owner"
            ? "Save as draft, submit for review, or publish directly."
            : "Save as draft to keep editing, or submit for review when it's ready."}
        </p>
        <div className="border border-black/10 bg-white p-6">
          <ListingForm currentUser={user} />
        </div>
      </section>

      {/* Listings with status tabs */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display text-2xl">Listings</h2>
        </div>
        <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto">
          {TAB_ORDER.map((tab) => {
            const count =
              tab === "all" ? allCount : counts[tab as ListingStatus];
            const active = tab === currentTab;
            return (
              <Link
                key={tab}
                href={`/admin?status=${tab}`}
                className={
                  "px-3 py-2 text-sm uppercase tracking-widest border-b-2 -mb-px transition-colors whitespace-nowrap " +
                  (active
                    ? "border-accent text-ink"
                    : "border-transparent text-black/50 hover:text-ink")
                }
              >
                {TAB_LABEL[tab]} <span className="text-black/40">({count})</span>
              </Link>
            );
          })}
        </div>

        {listings.length === 0 ? (
          <p className="text-black/50 text-sm">Nothing here.</p>
        ) : (
          <div className="border border-black/10 bg-white divide-y divide-black/10">
            {listings.map((l) => (
              <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/listings/${l.slug}`}
                      className="font-medium hover:text-accent truncate"
                    >
                      {l.title}
                    </Link>
                    <span
                      className={
                        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                        STATUS_BADGE[l.status]
                      }
                    >
                      {l.status}
                    </span>
                    {l.featured && (
                      <span className="text-[10px] uppercase tracking-widest bg-accent text-ink px-1.5 py-0.5">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-black/60 mt-0.5">
                    {l.location} · {formatPrice(l.price_usd)}
                  </p>
                  <p className="text-xs text-black/40 mt-0.5">
                    Created by {l.creator_name ?? "—"}
                    {l.status === "review" && l.submitted_at && (
                      <> · submitted {new Date(l.submitted_at).toLocaleString()}</>
                    )}
                    {l.status === "published" && l.published_at && (
                      <> · published {new Date(l.published_at).toLocaleString()}</>
                    )}
                  </p>
                </div>
                <ListingActions user={user} listing={l} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent inquiries */}
      <section>
        <h2 className="font-display text-2xl mb-6">Recent inquiries ({inquiries.length})</h2>
        {inquiries.length === 0 ? (
          <p className="text-black/50 text-sm">No inquiries yet.</p>
        ) : (
          <div className="border border-black/10 bg-white divide-y divide-black/10">
            {inquiries.map((i) => (
              <div key={i.id} className="p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <a href={`mailto:${i.email}`} className="text-sm text-accent hover:underline">
                      {i.email}
                    </a>
                    {i.phone && (
                      <span className="text-sm text-black/60 ml-2">· {i.phone}</span>
                    )}
                  </div>
                  <p className="text-xs text-black/50 shrink-0">
                    {new Date(i.created_at).toLocaleString()}
                  </p>
                </div>
                {i.listing_title && (
                  <p className="text-sm text-black/70 mt-2">
                    Re: <span className="font-medium">{i.listing_title}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {i.timeline && (
                    <span className="bg-black/5 px-2 py-1">
                      Timeline: {i.timeline.replace(/_/g, " ")}
                    </span>
                  )}
                  {i.pre_approved && (
                    <span className="bg-accent/20 text-accent px-2 py-1">Pre-approved</span>
                  )}
                </div>
                {i.message && (
                  <p className="text-sm text-black/80 mt-3 whitespace-pre-wrap">{i.message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
