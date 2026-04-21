import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import {
  countListingsByStatus,
  getAdminListingsWithCreators,
  getStaleListings,
  type AdminListingFilter
} from "@/lib/db";
import { ListingActions } from "@/components/ListingActions";
import { SoldActions, StillActiveButton } from "@/components/SoldActions";
import { Toast } from "@/components/Toast";
import { defaultAdminTab, isOwner } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";
import type { ListingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Listings — BallerCribs" };

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

function toastFromParams(sp: {
  toast?: string;
  title?: string;
  who?: string;
}): { message: string; variant: "success" | "info" | "warning" } | null {
  if (!sp.toast) return null;
  const title = sp.title ?? "Listing";
  switch (sp.toast) {
    case "submitted":
      return {
        message: "Listing submitted for review. You'll be notified when it's approved.",
        variant: "success"
      };
    case "draft_saved":
      return {
        message: "Draft saved. You can keep editing or submit it any time.",
        variant: "info"
      };
    case "published":
      return { message: `${title} is live.`, variant: "success" };
    case "approved":
      return { message: `Approved & published: ${title}.`, variant: "success" };
    case "sent_back":
      return {
        message: `Sent back to ${sp.who ?? "submitter"} for revisions.`,
        variant: "info"
      };
    case "saved":
      return { message: "Changes saved.", variant: "success" };
    default:
      return null;
  }
}

export default async function AdminListingsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    toast?: string;
    title?: string;
    who?: string;
  }>;
}) {
  const user = await requirePageUser();
  const sp = await searchParams;

  const requested = (sp.status as AdminListingFilter | undefined) ?? defaultAdminTab(user);
  const currentTab: AdminListingFilter = TAB_ORDER.includes(requested as AdminListingFilter)
    ? (requested as AdminListingFilter)
    : "all";

  const scopeUserId = isOwner(user) ? undefined : user.id;

  const [listings, counts, staleListings] = await Promise.all([
    getAdminListingsWithCreators(currentTab, scopeUserId).catch(() => []),
    countListingsByStatus(scopeUserId).catch(
      (): Record<ListingStatus, number> => ({
        draft: 0,
        review: 0,
        published: 0,
        archived: 0
      })
    ),
    isOwner(user) ? getStaleListings().catch(() => []) : Promise.resolve([])
  ]);

  const allCount = counts.draft + counts.review + counts.published;
  const toast = toastFromParams(sp);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h2 className="font-display text-2xl">
          {isOwner(user) ? "Listings" : "My listings"}
        </h2>
        <Link
          href="/admin/listings/new"
          className="bg-ink text-paper px-5 py-2.5 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
        >
          New Listing
        </Link>
      </div>

      {isOwner(user) && staleListings.length > 0 && (
        <section className="mb-10">
          <h3 className="font-display text-xl mb-1">Stale listings needing review</h3>
          <p className="text-sm text-black/60 mb-4">
            Published more than 90 days ago and not marked sold. Confirm still active to
            snooze for another 90 days, or mark sold to retire from the active grid.
          </p>
          <div className="border border-amber-200 bg-amber-50/50 divide-y divide-amber-200">
            {staleListings.map((l) => {
              const publishedAt = l.published_at ? new Date(l.published_at) : null;
              const days = publishedAt
                ? Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <div
                  key={l.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/listings/${l.id}/edit`}
                      className="font-medium hover:text-accent truncate"
                    >
                      {l.title}
                    </Link>
                    <p className="text-xs text-black/60 mt-0.5">
                      {l.location} · {formatPrice(l.price_usd)}
                    </p>
                    <p className="text-xs text-black/50 mt-0.5">
                      {days !== null ? `Published ${days} days ago` : "Published"}
                      {l.last_reviewed_at && (
                        <>
                          {" · last confirmed "}
                          {new Date(l.last_reviewed_at).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StillActiveButton listingId={l.id} />
                    <SoldActions user={user} listing={l} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto">
        {TAB_ORDER.map((tab) => {
          const count = tab === "all" ? allCount : counts[tab as ListingStatus];
          const active = tab === currentTab;
          return (
            <Link
              key={tab}
              href={`/admin/listings?status=${tab}`}
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
                    href={`/admin/listings/${l.id}/edit`}
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
                  {l.sold_at && (
                    <span className="text-[10px] uppercase tracking-widest bg-red-100 text-red-800 px-1.5 py-0.5">
                      Sold
                    </span>
                  )}
                  {l.featured && (
                    <span className="text-[10px] uppercase tracking-widest bg-accent text-ink px-1.5 py-0.5">
                      Featured
                    </span>
                  )}
                  {l.status === "published" && (
                    <Link
                      href={`/listings/${l.slug}`}
                      className="text-xs text-black/50 hover:text-accent underline underline-offset-2"
                    >
                      view live →
                    </Link>
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
                  {l.sold_at && (
                    <>
                      {" · sold "}
                      {new Date(l.sold_at).toLocaleDateString()}
                      {l.sold_price_usd !== null && <> for {formatPrice(l.sold_price_usd)}</>}
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ListingActions user={user} listing={l} />
                <SoldActions user={user} listing={l} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
