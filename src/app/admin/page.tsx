import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import {
  countAgentInquiriesByArchiveStatus,
  countInquiriesByArchiveStatus,
  countListingsByStatus,
  getAdminListingsWithCreators,
  getRecentAgentInquiries,
  getRecentInquiries,
  type AdminListingFilter
} from "@/lib/db";
import { ListingForm } from "@/components/ListingForm";
import { ListingActions } from "@/components/ListingActions";
import { InquiryActions } from "@/components/InquiryActions";
import { Toast } from "@/components/Toast";
import { defaultAdminTab, isOwner } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";
import type { ListingStatus, User } from "@/lib/types";

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

function pageTitleFor(user: User): string {
  return isOwner(user) ? "Admin" : "Listing Dashboard";
}

export async function generateMetadata(): Promise<Metadata> {
  // Best-effort role-aware title; falls back to "Admin" if not authed (the page
  // itself handles the redirect, this is just for the <title>).
  try {
    const user = await requirePageUser();
    return { title: `${pageTitleFor(user)} — Baller Cribs` };
  } catch {
    return { title: "Admin — Baller Cribs" };
  }
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
      return { message: "Draft saved. You can keep editing or submit it any time.", variant: "info" };
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

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    toast?: string;
    title?: string;
    who?: string;
    inquiries?: string;
    agents?: string;
  }>;
}) {
  const user = await requirePageUser();
  const sp = await searchParams;

  const requested = (sp.status as AdminListingFilter | undefined) ?? defaultAdminTab(user);
  const currentTab: AdminListingFilter = TAB_ORDER.includes(requested as AdminListingFilter)
    ? (requested as AdminListingFilter)
    : "all";

  // Independent archive toggles for each inquiry section. ?inquiries=archived
  // flips the buyer list; ?agents=archived flips the agent list.
  const inquiriesArchived = sp.inquiries === "archived";
  const agentsArchived = sp.agents === "archived";

  // Scope queries: owners see everyone's; users see only their own.
  const scopeUserId = isOwner(user) ? undefined : user.id;

  const [listings, counts, inquiries, agentInquiries, inquiryCounts, agentInquiryCounts] =
    await Promise.all([
      getAdminListingsWithCreators(currentTab, scopeUserId).catch(() => []),
      countListingsByStatus(scopeUserId).catch(
        (): Record<ListingStatus, number> => ({
          draft: 0,
          review: 0,
          published: 0,
          archived: 0
        })
      ),
      // Inquiries are owner-only — they go to a single notification email, not per-creator.
      isOwner(user)
        ? getRecentInquiries({ archived: inquiriesArchived, limit: 50 }).catch(() => [])
        : Promise.resolve([]),
      isOwner(user)
        ? getRecentAgentInquiries({ archived: agentsArchived, limit: 50 }).catch(() => [])
        : Promise.resolve([]),
      isOwner(user)
        ? countInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 }))
        : Promise.resolve({ active: 0, archived: 0 }),
      isOwner(user)
        ? countAgentInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 }))
        : Promise.resolve({ active: 0, archived: 0 })
    ]);

  const allCount = counts.draft + counts.review + counts.published; // 'All' hides archived
  const toast = toastFromParams(sp);
  const heading = pageTitleFor(user);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">{heading}</h1>
          <p className="text-sm text-black/60 mt-1">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/admin/account" className="underline underline-offset-4 hover:text-accent">
            Account
          </Link>
          {isOwner(user) && (
            <>
              <Link
                href="/admin/hero-photos"
                className="underline underline-offset-4 hover:text-accent"
              >
                Hero Photos
              </Link>
              <Link href="/admin/users" className="underline underline-offset-4 hover:text-accent">
                Users
              </Link>
            </>
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
          {isOwner(user)
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
          <h2 className="font-display text-2xl">{isOwner(user) ? "Listings" : "My listings"}</h2>
        </div>
        <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto">
          {TAB_ORDER.map((tab) => {
            const count = tab === "all" ? allCount : counts[tab as ListingStatus];
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
                    {/* Title now goes to the admin view/edit page, which handles read-only vs editable. */}
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
                  </p>
                </div>
                <ListingActions user={user} listing={l} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent inquiries — owner only */}
      {isOwner(user) && (
        <section>
          <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
            <h2 className="font-display text-2xl">
              Recent inquiries
              {inquiriesArchived && " — Archived"} ({inquiries.length})
            </h2>
            <ArchiveTabs
              section="inquiries"
              currentArchived={inquiriesArchived}
              activeCount={inquiryCounts.active}
              archivedCount={inquiryCounts.archived}
            />
          </div>
          {inquiries.length === 0 ? (
            <p className="text-black/50 text-sm">
              {inquiriesArchived ? "No archived inquiries." : "No inquiries yet."}
            </p>
          ) : (
            <div className="border border-black/10 bg-white divide-y divide-black/10">
              {inquiries.map((i) => (
                <div key={i.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-medium">{i.name}</p>
                      <a href={`mailto:${i.email}`} className="text-sm text-accent hover:underline">
                        {i.email}
                      </a>
                      {i.phone && (
                        <span className="text-sm text-black/60 ml-2">· {i.phone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-xs text-black/50">
                        {new Date(i.created_at).toLocaleString()}
                      </p>
                      <InquiryActions id={i.id} kind="buyer" archived={inquiriesArchived} />
                    </div>
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
                    {i.archived_at && (
                      <span className="bg-black/5 text-black/50 px-2 py-1">
                        Archived {new Date(i.archived_at).toLocaleDateString()}
                      </span>
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
      )}

      {/* Agent inquiries (from /agents) — owner only */}
      {isOwner(user) && (
        <section className="mt-16">
          <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
            <h2 className="font-display text-2xl">
              Agent inquiries
              {agentsArchived && " — Archived"} ({agentInquiries.length})
            </h2>
            <ArchiveTabs
              section="agents"
              currentArchived={agentsArchived}
              activeCount={agentInquiryCounts.active}
              archivedCount={agentInquiryCounts.archived}
            />
          </div>
          {agentInquiries.length === 0 ? (
            <p className="text-black/50 text-sm">
              {agentsArchived ? "No archived agent inquiries." : "No agent inquiries yet."}
            </p>
          ) : (
            <div className="border border-black/10 bg-white divide-y divide-black/10">
              {agentInquiries.map((a) => {
                const typeBadge =
                  a.inquiry_type === "featured"
                    ? "bg-accent/20 text-accent"
                    : a.inquiry_type === "referral"
                      ? "bg-green-100 text-green-800"
                      : "bg-black/10 text-black/70";
                return (
                  <div key={a.id} className="p-4">
                    <div className="flex items-baseline justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{a.name}</p>
                        <span
                          className={
                            "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + typeBadge
                          }
                        >
                          {a.inquiry_type}
                        </span>
                        {a.archived_at && (
                          <span className="text-[10px] uppercase tracking-widest bg-black/5 text-black/50 px-1.5 py-0.5">
                            Archived {new Date(a.archived_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-xs text-black/50">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                        <InquiryActions id={a.id} kind="agent" archived={agentsArchived} />
                      </div>
                    </div>
                    <p className="text-sm mt-1">
                      <a href={`mailto:${a.email}`} className="text-accent hover:underline">
                        {a.email}
                      </a>
                      {a.phone && <span className="text-black/60 ml-2">· {a.phone}</span>}
                    </p>
                    {(a.brokerage || a.city_state) && (
                      <p className="text-xs text-black/60 mt-1">
                        {a.brokerage}
                        {a.brokerage && a.city_state ? " · " : ""}
                        {a.city_state}
                      </p>
                    )}
                    {a.message && (
                      <p className="text-sm text-black/80 mt-3 whitespace-pre-wrap">
                        {a.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Two-tab segmented control for the Active / Archived filter. Server component —
 * tabs are just Links that toggle the ?inquiries= or ?agents= search param so
 * bookmarking + browser-back preserve state.
 */
function ArchiveTabs({
  section,
  currentArchived,
  activeCount,
  archivedCount
}: {
  section: "inquiries" | "agents";
  currentArchived: boolean;
  activeCount: number;
  archivedCount: number;
}) {
  const activeHref = `/admin?${section}=active`;
  const archivedHref = `/admin?${section}=archived`;
  const base =
    "px-3 py-1 text-xs uppercase tracking-widest border transition-colors";
  const activeCls = "bg-ink text-paper border-ink";
  const idleCls = "border-black/20 text-black/60 hover:border-black/50";
  return (
    <div className="flex gap-0 isolate" role="tablist" aria-label={`${section} filter`}>
      <Link
        href={activeHref}
        scroll={false}
        role="tab"
        aria-selected={!currentArchived}
        className={base + " " + (!currentArchived ? activeCls : idleCls)}
      >
        Active ({activeCount})
      </Link>
      <Link
        href={archivedHref}
        scroll={false}
        role="tab"
        aria-selected={currentArchived}
        className={base + " -ml-px " + (currentArchived ? activeCls : idleCls)}
      >
        Archived ({archivedCount})
      </Link>
    </div>
  );
}
