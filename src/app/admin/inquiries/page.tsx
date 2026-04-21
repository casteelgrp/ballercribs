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
import { listPayments } from "@/lib/payments";
import type { Payment } from "@/lib/payments/types";
import { InquiryList } from "@/components/InquiryList";
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

  const [inquiries, agentInquiries, inquiryCounts, agentInquiryCounts, allPayments] =
    await Promise.all([
      getRecentInquiries({ archived: inquiriesArchived, limit: 50 }).catch(() => []),
      getRecentAgentInquiries({ archived: agentsArchived, limit: 50 }).catch(() => []),
      countInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 })),
      countAgentInquiriesByArchiveStatus().catch(() => ({ active: 0, archived: 0 })),
      // Single fetch + in-memory group is cheaper than N queries for the
      // current volume; revisit with a joined query if the inquiries table
      // grows past a few hundred rows.
      listPayments({ limit: 500 }).catch(() => [])
    ]);

  const agentPayments = groupPaymentsByInquiry(allPayments, "agent_feature");
  const buyerPayments = groupPaymentsByInquiry(allPayments, "buyer_lead");

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
          <InquiryList
            inquiries={inquiries}
            kind="buyer"
            isOwner={true}
            paymentsByInquiry={buyerPayments}
          />
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
          <InquiryList
            inquiries={agentInquiries}
            kind="agent"
            isOwner={true}
            paymentsByInquiry={agentPayments}
          />
        )}
      </section>
    </div>
  );
}

function groupPaymentsByInquiry(
  payments: Payment[],
  type: Payment["inquiry_type"]
): Record<number, Payment[]> {
  const out: Record<number, Payment[]> = {};
  for (const p of payments) {
    if (p.inquiry_type !== type) continue;
    if (!out[p.inquiry_id]) out[p.inquiry_id] = [];
    out[p.inquiry_id].push(p);
  }
  return out;
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
