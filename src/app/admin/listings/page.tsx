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
import { isOwner } from "@/lib/permissions";
import { formatPrice } from "@/lib/currency";
import type { ListingStatus, ListingType } from "@/lib/types";

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

// Per-status pill colors. REVIEW uses the site accent token (not generic amber)
// so the "something to look at" signal matches the REVIEW tab highlight.
// ARCHIVED is darker than DRAFT so the two faint-gray states don't blur together.
const STATUS_BADGE: Record<ListingStatus, string> = {
  draft: "bg-black/10 text-black/70",
  review: "bg-accent/20 text-accent",
  published: "bg-green-100 text-green-800",
  archived: "bg-black/20 text-black/40"
};

// Rental uses a warm neutral so it reads as a sibling to sale's cool
// slate — both are categories, not status. Emerald is reserved for the
// PUBLISHED status badge; the two badges sit next to each other on
// rental rows and the prior shared color made them blur together.
const TYPE_BADGE: Record<ListingType, string> = {
  sale: "bg-slate-100 text-slate-700",
  rental: "bg-stone-200 text-stone-700"
};

const TYPE_FILTER_OPTIONS: { value: "all" | ListingType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "Sale" },
  { value: "rental", label: "Rental" }
];

const RENTAL_UNIT_LABEL: Record<"night" | "week" | "month", string> = {
  night: "night",
  week: "week",
  month: "month"
};

/**
 * Renders the admin-table price column for either a sale or rental row.
 * Sale: `$4.25M` (existing behavior). Rental: `$2,500/night` compact
 * formatting built from rental_price_cents + unit. Falls back to a "—"
 * when a rental row is incomplete (shouldn't happen post-validation but
 * keeps the table resilient).
 */
function renderRowPrice(l: {
  listing_type: ListingType;
  price_usd: number;
  currency: string;
  rental_price_cents: number | null;
  rental_price_unit: "night" | "week" | "month" | null;
}): string {
  if (l.listing_type !== "rental") {
    return formatPrice(l.price_usd, l.currency);
  }
  if (l.rental_price_cents === null || l.rental_price_unit === null) {
    return "—";
  }
  const whole = Math.round(l.rental_price_cents / 100);
  const base = formatPrice(whole, l.currency);
  return `${base}/${RENTAL_UNIT_LABEL[l.rental_price_unit]}`;
}

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
    case "unpublished":
      return {
        message: `${title} unpublished — now in drafts.`,
        variant: "info"
      };
    default:
      return null;
  }
}

export default async function AdminListingsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    toast?: string;
    title?: string;
    who?: string;
  }>;
}) {
  const user = await requirePageUser();
  const sp = await searchParams;

  // Default to "all" so the page never looks empty on first load. The REVIEW
  // tab draws attention via color when it has pending items (see tab loop below).
  const requested = (sp.status as AdminListingFilter | undefined) ?? "all";
  const currentTab: AdminListingFilter = TAB_ORDER.includes(requested as AdminListingFilter)
    ? (requested as AdminListingFilter)
    : "all";

  const typeFilter: "all" | ListingType =
    sp.type === "sale" || sp.type === "rental" ? sp.type : "all";
  const typeFilterArg: ListingType | undefined =
    typeFilter === "all" ? undefined : typeFilter;

  const scopeUserId = isOwner(user) ? undefined : user.id;

  const [listings, counts, staleListings] = await Promise.all([
    getAdminListingsWithCreators(currentTab, scopeUserId, typeFilterArg).catch(() => []),
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
                      {l.location} · {formatPrice(l.price_usd, l.currency)}
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

      {/* Type filter pills — stack with the status tabs below. URL-driven
          so bookmark + back-button preserve the state. Status tab hrefs
          below carry the current type param through so flipping status
          doesn't reset the type selection. */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="text-xs uppercase tracking-widest text-black/50 w-16 shrink-0">
          Type
        </span>
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTER_OPTIONS.map((opt) => {
            const on = opt.value === typeFilter;
            const params = new URLSearchParams();
            if (currentTab !== "all") params.set("status", currentTab);
            if (opt.value !== "all") params.set("type", opt.value);
            const qs = params.toString();
            return (
              <Link
                key={opt.value}
                href={qs ? `/admin/listings?${qs}` : "/admin/listings"}
                scroll={false}
                className={
                  "text-xs uppercase tracking-widest px-3 py-1.5 border transition-colors " +
                  (on
                    ? "bg-ink text-paper border-ink"
                    : "bg-white text-black/60 border-black/20 hover:border-black/40")
                }
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* overflow-x-auto only on narrow viewports — the 5 status tabs fit
          comfortably on desktop and macOS with "always show scrollbars"
          was rendering stray arrow chrome on the row. */}
      <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto md:overflow-x-visible">
        {TAB_ORDER.map((tab) => {
          const count = tab === "all" ? allCount : counts[tab as ListingStatus];
          const active = tab === currentTab;
          // REVIEW is the only tab that's a call to action — colored accent
          // when there's something pending so it reads as "REVIEW (3)" in gold.
          const highlight = !active && tab === "review" && counts.review > 0;
          const textCls = active
            ? "border-accent text-ink"
            : highlight
              ? "border-transparent text-accent hover:text-ink"
              : "border-transparent text-black/50 hover:text-ink";
          const countCls = highlight ? "" : "text-black/40";
          // ALL has no status param — cleaner default URL. Carry the
          // current type filter through so switching status doesn't drop
          // it. The tab's own "all" case also drops ?status=.
          const params = new URLSearchParams();
          if (tab !== "all") params.set("status", tab);
          if (typeFilter !== "all") params.set("type", typeFilter);
          const qs = params.toString();
          const href = qs ? `/admin/listings?${qs}` : "/admin/listings";
          return (
            <Link
              key={tab}
              href={href}
              className={
                "px-3 py-2 text-sm uppercase tracking-widest border-b-2 -mb-px transition-colors whitespace-nowrap " +
                textCls
              }
            >
              {TAB_LABEL[tab]} <span className={countCls}>({count})</span>
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
                      TYPE_BADGE[l.listing_type]
                    }
                  >
                    {l.listing_type}
                  </span>
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
                      href={
                        l.listing_type === "rental"
                          ? `/rentals/${l.slug}`
                          : `/listings/${l.slug}`
                      }
                      className="text-xs text-black/50 hover:text-accent underline underline-offset-2"
                    >
                      view live →
                    </Link>
                  )}
                </div>
                <p className="text-xs text-black/60 mt-0.5">
                  {l.location} · {renderRowPrice(l)}
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
                      {l.sold_price_usd !== null && (
                        <> for {formatPrice(l.sold_price_usd, l.currency)}</>
                      )}
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
