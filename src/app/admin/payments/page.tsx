import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { countPaymentsByStatus, listPayments } from "@/lib/payments";
import type { PaymentStatus } from "@/lib/payments/types";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payments — BallerCribs" };

const TAB_ORDER: (PaymentStatus | "all")[] = [
  "all",
  "pending",
  "paid",
  "failed"
];

const TAB_LABEL: Partial<Record<PaymentStatus | "all", string>> = {
  all: "All",
  pending: "Pending",
  paid: "Paid",
  failed: "Failed"
};

const STATUS_BADGE: Record<PaymentStatus, string> = {
  pending: "bg-accent/20 text-accent",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-blue-100 text-blue-800",
  cancelled: "bg-black/10 text-black/40"
};

function formatAmount(amountCents: number, currency: string): string {
  const dollars = amountCents / 100;
  return `$${dollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePageUser();
  if (!isOwner(user)) notFound();

  const sp = await searchParams;
  const requested = sp.status as (typeof TAB_ORDER)[number] | undefined;
  const currentTab: (typeof TAB_ORDER)[number] =
    requested && TAB_ORDER.includes(requested) ? requested : "all";

  const [payments, counts] = await Promise.all([
    listPayments({
      limit: 200,
      status: currentTab === "all" ? undefined : currentTab
    }).catch(() => []),
    countPaymentsByStatus().catch(() => ({
      all: 0,
      pending: 0,
      paid: 0,
      failed: 0,
      refunded: 0,
      cancelled: 0
    }))
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <h2 className="font-display text-2xl mb-6">Payments</h2>

      {/* Match the listings page — overflow-x-auto only on narrow widths
          so desktop doesn't render scroll chrome on a row that fits. */}
      <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto md:overflow-x-visible">
        {TAB_ORDER.map((tab) => {
          const count = counts[tab] ?? 0;
          const active = tab === currentTab;
          const href = tab === "all" ? "/admin/payments" : `/admin/payments?status=${tab}`;
          return (
            <Link
              key={tab}
              href={href}
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

      {payments.length === 0 ? (
        <p className="text-black/50 text-sm">No payments yet.</p>
      ) : (
        <div className="border border-black/10 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase tracking-widest text-black/50">
              <tr>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Inquiry</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {payments.map((p) => {
                const inquiryHref =
                  p.inquiry_type === "agent_feature"
                    ? "/admin/inquiries#agents"
                    : "/admin/inquiries";
                return (
                  <tr key={p.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-3 whitespace-nowrap text-black/60">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={inquiryHref}
                        className="text-accent hover:underline"
                      >
                        {p.inquiry_name ?? `${p.inquiry_type} #${p.inquiry_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-black/70">{p.tier ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {formatAmount(p.amount_cents, p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                          STATUS_BADGE[p.status]
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black/70">
                      {p.payment_method ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-black/60">
                      {p.reference_code}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
