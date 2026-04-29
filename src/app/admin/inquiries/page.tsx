import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import {
  getAllPartners,
  getRecentAgentInquiries,
  getRecentInquiries,
  getRecentRentalInquiries
} from "@/lib/db";
import { listPayments } from "@/lib/payments";
import type { Payment } from "@/lib/payments/types";
import {
  UnifiedInquiryInbox,
  type ForwardedFilter,
  type StatusFilter,
  type TypeFilter,
  type UnifiedInquiryRow
} from "@/components/admin/UnifiedInquiryInbox";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inquiries — BallerCribs" };

const VALID_TYPES: TypeFilter[] = ["all", "buyer", "agent", "rental"];
const VALID_STATUSES: StatusFilter[] = ["all", "new", "working", "won", "dead"];
const VALID_FORWARDED: ForwardedFilter[] = ["all", "unforwarded"];

function normalizeTypeFilter(raw: string | undefined): TypeFilter {
  return raw && (VALID_TYPES as string[]).includes(raw) ? (raw as TypeFilter) : "all";
}

function normalizeStatusFilter(raw: string | undefined): StatusFilter {
  return raw && (VALID_STATUSES as string[]).includes(raw)
    ? (raw as StatusFilter)
    : "all";
}

function normalizeForwardedFilter(raw: string | undefined): ForwardedFilter {
  return raw && (VALID_FORWARDED as string[]).includes(raw)
    ? (raw as ForwardedFilter)
    : "all";
}

export default async function AdminInquiriesPage({
  searchParams
}: {
  searchParams: Promise<{ type?: string; status?: string; forwarded?: string }>;
}) {
  const user = await requirePageUser();
  // Inquiries live on a single notification inbox — only owners see them.
  if (!isOwner(user)) notFound();

  const sp = await searchParams;
  const typeFilter = normalizeTypeFilter(sp.type);
  const statusFilter = normalizeStatusFilter(sp.status);
  const forwardedFilter = normalizeForwardedFilter(sp.forwarded);

  // Fetch all three tables regardless of the type filter so flipping
  // filters doesn't require a round-trip. Archived rows are excluded at
  // the DB layer — unified inbox doesn't surface archived today; it's
  // still reachable per-row via the Archive/Unarchive action. Partners
  // load alongside so the Partner column resolves names without an
  // N+1 (lookup map keyed by id).
  const [inquiries, agentInquiries, rentalInquiries, allPayments, partners] =
    await Promise.all([
      getRecentInquiries({ archived: false, limit: 100 }).catch(() => []),
      getRecentAgentInquiries({ archived: false, limit: 100 }).catch(() => []),
      getRecentRentalInquiries({ archived: false, limit: 100 }).catch(() => []),
      listPayments({ limit: 500 }).catch(() => []),
      getAllPartners().catch(() => [])
    ]);

  const rows = mergeAndSort(inquiries, agentInquiries, rentalInquiries);
  const paymentsByInquiry = {
    agent: groupPayments(allPayments, "agent_feature"),
    rental: groupPayments(allPayments, "rental")
  };
  const partnerNameById: Record<string, string> = Object.fromEntries(
    partners.map((p) => [p.id, p.name])
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <h2 className="font-display text-2xl mb-2">Inquiries</h2>
      <p className="text-sm text-black/60 mb-6">
        One inbox for every source. Filter by type or status, click a row to
        open pipeline controls.
      </p>

      <UnifiedInquiryInbox
        rows={rows}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        forwardedFilter={forwardedFilter}
        partnerNameById={partnerNameById}
        isOwner={true}
        paymentsByInquiry={paymentsByInquiry}
      />
    </div>
  );
}

function mergeAndSort(
  buyer: Awaited<ReturnType<typeof getRecentInquiries>>,
  agent: Awaited<ReturnType<typeof getRecentAgentInquiries>>,
  rental: Awaited<ReturnType<typeof getRecentRentalInquiries>>
): UnifiedInquiryRow[] {
  const tagged: UnifiedInquiryRow[] = [
    ...buyer.map((b) => ({ ...b, kind: "buyer" as const })),
    ...agent.map((a) => ({ ...a, kind: "agent" as const })),
    ...rental.map((r) => ({ ...r, kind: "rental" as const }))
  ];
  tagged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return tagged;
}

function groupPayments(
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
