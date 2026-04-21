"use client";

import { useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/payments/types";

type Method = Extract<PaymentMethod, "zelle" | "wire" | "check" | "cash">;

const METHOD_LABELS: Record<Method, string> = {
  zelle: "Zelle",
  wire: "Wire transfer",
  check: "Check",
  cash: "Cash"
};

export function MarkPaidDialog({
  paymentId,
  amountLabel,
  onClose,
  onMarked
}: {
  paymentId: number;
  /** e.g. "$1,500.00 USD" — pre-formatted for display. */
  amountLabel: string;
  onClose: () => void;
  onMarked: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [method, setMethod] = useState<Method>("zelle");
  const [receivedDate, setReceivedDate] = useState<string>(todayIso);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/mark-paid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payment_method: method,
          received_date: receivedDate || undefined,
          notes: notes.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Mark-paid failed.");
        setSubmitting(false);
        return;
      }
      onMarked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mp-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md bg-paper border border-black/10 p-6 space-y-4 shadow-xl"
      >
        <div>
          <h2 id="mp-title" className="font-display text-xl leading-snug">
            Mark payment as received
          </h2>
          <p className="text-xs text-black/50 mt-1">{amountLabel}</p>
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-widest text-black/60 block mb-1"
            htmlFor="mp-method"
          >
            Method
          </label>
          <select
            id="mp-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-widest text-black/60 block mb-1"
            htmlFor="mp-date"
          >
            Received date
          </label>
          <input
            id="mp-date"
            type="date"
            max={todayIso}
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-widest text-black/60 block mb-1"
            htmlFor="mp-notes"
          >
            Notes (optional)
          </label>
          <textarea
            id="mp-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Zelle confirmation #12345"
            className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xs uppercase tracking-widest border border-black/20 px-3 py-2 hover:border-black/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-xs uppercase tracking-widest bg-ink text-paper border border-ink px-4 py-2 hover:bg-accent hover:text-ink hover:border-accent disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Mark paid"}
          </button>
        </div>
      </form>
    </div>
  );
}
