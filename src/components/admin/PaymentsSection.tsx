"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { PaymentLinkModal, type GenerateLinkResult } from "./PaymentLinkModal";
import type { Payment, PaymentStatus } from "@/lib/payments/types";

/**
 * One-shot banner shown after Generate Payment Link resolves. Success state
 * displays "Link sent to X"; failure state surfaces the email error and a
 * copy-to-clipboard button so the admin has a fallback (paste into Signal /
 * iMessage / whatever).
 */
interface LinkStatus {
  kind: "sent" | "failed" | "alt_sent" | "alt_failed";
  emailTo: string;
  emailError?: string;
  payment: Payment;
}

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

/**
 * Rendered inside the expanded inquiry card. Lists payments + exposes the
 * "Generate Payment Link" CTA when appropriate.
 *
 * `canGenerate` gates on: owner + agent_feature + status === 'working'. The
 * caller computes it so this component doesn't need the inquiry context.
 */
export function PaymentsSection({
  inquiryId,
  inquiryName,
  inquiryType = "agent_feature",
  payments,
  canGenerate,
  canMarkPaid,
  defaultDescription
}: {
  inquiryId: number;
  inquiryName: string;
  /** Which inquiry table this payment links to. Passed through to the
   *  PaymentLinkModal + generate-link API. Defaults to agent_feature to
   *  preserve the original single-kind call shape. */
  inquiryType?: "agent_feature" | "rental";
  payments: Payment[];
  canGenerate: boolean;
  canMarkPaid: boolean;
  defaultDescription?: string;
}) {
  const router = useRouter();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [markPaidFor, setMarkPaidFor] = useState<Payment | null>(null);
  const [resending, setResending] = useState<number | null>(null);
  const [copiedFor, setCopiedFor] = useState<number | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [bannerCopied, setBannerCopied] = useState(false);

  function refresh() {
    router.refresh();
  }

  function onLinkGenerated(result: GenerateLinkResult) {
    const base = result.method === "square" ? "sent" : "alt_sent";
    const failed = result.method === "square" ? "failed" : "alt_failed";
    setLinkStatus({
      kind: result.emailSent ? base : failed,
      emailTo: result.emailTo,
      emailError: result.emailError,
      payment: result.payment
    });
    setLinkModalOpen(false);
    refresh();
  }

  async function copyBannerLink() {
    if (!linkStatus) return;
    const text = linkStatus.payment.checkout_url ?? linkStatus.payment.reference_code;
    try {
      await navigator.clipboard.writeText(text);
      setBannerCopied(true);
      setTimeout(() => setBannerCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }

  async function onResend(p: Payment) {
    // Placeholder: no dedicated endpoint yet — regenerating is the move.
    // Calling generate-link again creates a fresh row; we'll wire a
    // proper resend once we have real volume to justify a new endpoint.
    // For now, just copy the link to clipboard and flash confirmation.
    if (!p.checkout_url) return;
    setResending(p.id);
    try {
      await navigator.clipboard.writeText(p.checkout_url);
      setCopiedFor(p.id);
      setTimeout(() => setCopiedFor(null), 1500);
    } finally {
      setResending(null);
    }
  }

  async function onCopyReference(p: Payment) {
    try {
      await navigator.clipboard.writeText(p.reference_code);
      setCopiedFor(p.id);
      setTimeout(() => setCopiedFor(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-black/50">Payments</p>
        {canGenerate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLinkModalOpen(true);
            }}
            className="text-xs uppercase tracking-widest border border-ink text-ink px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors"
          >
            Generate payment link
          </button>
        )}
      </div>

      {linkStatus && (
        <LinkStatusBanner
          status={linkStatus}
          copied={bannerCopied}
          onCopy={copyBannerLink}
          onDismiss={() => setLinkStatus(null)}
        />
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-black/50">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-black/10 border border-black/10">
          {payments.map((p) => {
            const isAlternate = Boolean(p.checkout_url) === false && p.status === "pending";
            const isSquarePending = Boolean(p.checkout_url) && p.status === "pending";
            return (
              <li key={p.id} className="p-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span
                      className={
                        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                        STATUS_BADGE[p.status]
                      }
                    >
                      {p.status}
                    </span>
                    <span className="font-medium text-sm">
                      {formatAmount(p.amount_cents, p.currency)}
                    </span>
                    {p.tier && (
                      <span className="text-[10px] uppercase tracking-widest border border-black/20 text-black/60 px-1.5 py-0.5">
                        {p.tier}
                      </span>
                    )}
                    {p.payment_method && (
                      <span className="text-xs text-black/60">· {p.payment_method}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {isSquarePending && (
                      <button
                        type="button"
                        disabled={resending === p.id}
                        onClick={() => onResend(p)}
                        className="text-[11px] uppercase tracking-widest border border-black/20 px-2.5 py-1 hover:border-accent hover:text-accent disabled:opacity-40"
                      >
                        {copiedFor === p.id ? "Copied" : "Copy link"}
                      </button>
                    )}
                    {isAlternate && canMarkPaid && (
                      <button
                        type="button"
                        onClick={() => setMarkPaidFor(p)}
                        className="text-[11px] uppercase tracking-widest border border-black/20 px-2.5 py-1 hover:border-accent hover:text-accent"
                      >
                        Mark paid
                      </button>
                    )}
                    {p.status === "paid" && p.provider_payment_id && (
                      <a
                        href={`https://squareup.com/dashboard/sales/transactions/${p.provider_payment_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] uppercase tracking-widest border border-black/20 px-2.5 py-1 hover:border-accent hover:text-accent"
                      >
                        View in Square
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-black/50">
                  <button
                    type="button"
                    onClick={() => onCopyReference(p)}
                    className="font-mono hover:text-accent"
                    title="Copy reference code"
                  >
                    {p.reference_code}
                  </button>
                  <span>·</span>
                  <span>{new Date(p.created_at).toLocaleString()}</span>
                  {p.paid_at && (
                    <>
                      <span>·</span>
                      <span className="text-green-800">
                        paid {new Date(p.paid_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>

                {p.line_item_description && (
                  <p className="text-xs text-black/70 mt-1">{p.line_item_description}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {linkModalOpen && (
        <PaymentLinkModal
          inquiryId={inquiryId}
          inquiryName={inquiryName}
          inquiryType={inquiryType}
          defaultDescription={defaultDescription}
          onClose={() => setLinkModalOpen(false)}
          onCreated={onLinkGenerated}
        />
      )}
      {markPaidFor && (
        <MarkPaidDialog
          paymentId={markPaidFor.id}
          amountLabel={formatAmount(markPaidFor.amount_cents, markPaidFor.currency)}
          onClose={() => setMarkPaidFor(null)}
          onMarked={() => {
            setMarkPaidFor(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function LinkStatusBanner({
  status,
  copied,
  onCopy,
  onDismiss
}: {
  status: LinkStatus;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  const ok = status.kind === "sent" || status.kind === "alt_sent";
  const hasUrl = Boolean(status.payment.checkout_url);

  // Color tokens: success = green accent, failure = amber (not red — payment
  // itself is fine, only the email failed and we have a clear fallback).
  const containerCls = ok
    ? "border-green-300 bg-green-50 text-green-900"
    : "border-amber-300 bg-amber-50 text-amber-900";

  const message = (() => {
    if (status.kind === "sent") return `Link sent to ${status.emailTo}.`;
    if (status.kind === "alt_sent") return `Instructions sent to ${status.emailTo}.`;
    if (status.kind === "failed") {
      return `Link created but email failed — copy it and send manually.`;
    }
    return `Instructions created but email failed — copy the reference code and send manually.`;
  })();

  const copyLabel = hasUrl ? "Copy link" : "Copy reference";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border ${containerCls} px-3 py-2 mb-3 text-sm`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p>{message}</p>
          {status.emailError && (
            <p className="text-xs mt-1 opacity-80 break-words">
              <span className="uppercase tracking-widest">Resend:</span> {status.emailError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCopy}
            className="text-[11px] uppercase tracking-widest border border-current px-2.5 py-1 hover:bg-current hover:text-paper transition-colors"
          >
            {copied ? "Copied" : copyLabel}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="text-current opacity-60 hover:opacity-100 px-2"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
