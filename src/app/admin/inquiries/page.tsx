import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import {
  countAgentInquiriesByArchiveStatus,
  countInquiriesByArchiveStatus,
  getRecentAgentInquiries,
  getRecentInquiries
} from "@/lib/db";
import { InquiryActions } from "@/components/InquiryActions";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inquiries — BallerCribs" };

export default async function AdminInquiriesPage({
  searchParams
}: {
  searchParams: Promise<{ inquiries?: string; agents?: string }>;
}) {
  const user = await requirePageUser();
  // Inquiries live on a single notification inbox — only owners see them.
  if (!isOwner(user)) notFound();

  const sp = await searchParams;
  const inquiriesArchived = sp.inquiries === "archived";
  const agentsArchived = sp.agents === "archived";

  const [inquiries, agentInquiries, inquiryCounts, agentInquiryCounts] = await Promise.all([
    getRecentInquiries({ archived: inquiriesArchived, limit: 50 }).catch(() => []),
    getRecentAgentInquiries({ archived: agentsArchived, limit: 50 }).catch(() => []),
    countInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 })),
    countAgentInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 }))
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <section>
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-display text-2xl">
            Buyer inquiries
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
                    {i.phone && <span className="text-sm text-black/60 ml-2">· {i.phone}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-xs text-black/50">
                      {new Date(i.created_at).toLocaleString()}
                    </p>
                    <InquiryActions id={i.id} kind="buyer" archived={inquiriesArchived} />
                  </div>
                </div>
                {i.listing_id && (
                  <p className="text-sm text-black/70 mt-2">
                    Re:{" "}
                    {i.listing_slug && i.listing_title ? (
                      <Link
                        href={`/listings/${i.listing_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent underline underline-offset-2 hover:text-ink"
                      >
                        {i.listing_title}
                      </Link>
                    ) : (
                      <>
                        <span className="font-medium">
                          {i.listing_title ?? "Unknown listing"}
                        </span>
                        <span className="text-black/40 italic ml-2">
                          (listing no longer available)
                        </span>
                      </>
                    )}
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

      <section id="agents" className="mt-16 scroll-mt-24">
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
                    <p className="text-sm text-black/80 mt-3 whitespace-pre-wrap">{a.message}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Two-tab segmented control for the Active / Archived filter. Tabs are just
 * Links that toggle the ?inquiries= or ?agents= search param so bookmarking +
 * browser-back preserve state.
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
  const hash = section === "agents" ? "#agents" : "";
  const activeHref = `/admin/inquiries?${section}=active${hash}`;
  const archivedHref = `/admin/inquiries?${section}=archived${hash}`;
  const base = "px-3 py-1 text-xs uppercase tracking-widest border transition-colors";
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
