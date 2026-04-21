"use client";

import { useEffect, useState } from "react";
import { TIERS, TIER_KEYS, type TierKey } from "@/lib/payments/tiers";

type Method = "square" | "alternate";

export function PaymentLinkModal({
  inquiryId,
  inquiryName,
  defaultDescription,
  onClose,
  onCreated
}: {
  inquiryId: number;
  inquiryName: string;
  defaultDescription?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tier, setTier] = useState<TierKey>("featured");
  const [customDollars, setCustomDollars] = useState<string>("");
  const [description, setDescription] = useState<string>(
    defaultDescription ?? `Featured placement for ${inquiryName}`
  );
  const [method, setMethod] = useState<Method>("square");
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

    let amountCents: number | undefined;
    if (tier === "custom") {
      const n = Number(customDollars.trim());
      if (!Number.isFinite(n) || n < 1) {
        setError("Custom amount must be at least $1.");
        return;
      }
      amountCents = Math.round(n * 100);
    }

    if (!description.trim()) {
      setError("Line item description is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/payments/generate-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inquiry_id: inquiryId,
          inquiry_type: "agent_feature",
          tier,
          amount_cents: amountCents,
          line_item_description: description.trim(),
          payment_method: method
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Failed to generate payment link.");
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const primaryLabel =
    method === "square" ? "Send payment link" : "Send payment instructions";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plink-title"
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
        className="relative z-10 w-full max-w-lg bg-paper border border-black/10 p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h2 id="plink-title" className="font-display text-xl leading-snug">
            Generate payment link
          </h2>
          <p className="text-xs text-black/50 mt-1">For {inquiryName}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs uppercase tracking-widest text-black/60 mb-1">
            Tier
          </legend>
          {TIER_KEYS.map((key) => {
            const cfg = TIERS[key];
            const price =
              cfg.amountCents !== null
                ? ` — $${(cfg.amountCents / 100).toLocaleString()}`
                : " — custom amount";
            return (
              <label
                key={key}
                className="flex items-start gap-3 border border-black/10 p-3 cursor-pointer hover:border-black/30"
              >
                <input
                  type="radio"
                  name="tier"
                  value={key}
                  checked={tier === key}
                  onChange={() => setTier(key)}
                  className="mt-1 accent-accent"
                />
                <span className="flex-1">
                  <span className="font-medium">
                    {cfg.label}
                    <span className="text-black/60 font-normal">{price}</span>
                  </span>
                  <span className="block text-xs text-black/55 mt-0.5">
                    {cfg.description}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {tier === "custom" && (
          <div>
            <label
              className="text-xs uppercase tracking-widest text-black/60 block mb-1"
              htmlFor="plink-custom"
            >
              Custom amount (USD)
            </label>
            <input
              id="plink-custom"
              type="number"
              min={1}
              step={0.01}
              value={customDollars}
              onChange={(e) => setCustomDollars(e.target.value)}
              className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. 7500"
            />
          </div>
        )}

        <div>
          <label
            className="text-xs uppercase tracking-widest text-black/60 block mb-1"
            htmlFor="plink-desc"
          >
            Line item description
          </label>
          <input
            id="plink-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Featured placement for 123 Main St"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs uppercase tracking-widest text-black/60 mb-1">
            Payment method
          </legend>
          <label className="flex items-start gap-3 border border-black/10 p-3 cursor-pointer hover:border-black/30">
            <input
              type="radio"
              name="method"
              value="square"
              checked={method === "square"}
              onChange={() => setMethod("square")}
              className="mt-1 accent-accent"
            />
            <span className="flex-1">
              <span className="font-medium">Square (card or ACH)</span>
              <span className="block text-xs text-black/55 mt-0.5">
                Hosted checkout. Agent receives a link and pays online.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 border border-black/10 p-3 cursor-pointer hover:border-black/30">
            <input
              type="radio"
              name="method"
              value="alternate"
              checked={method === "alternate"}
              onChange={() => setMethod("alternate")}
              className="mt-1 accent-accent"
            />
            <span className="flex-1">
              <span className="font-medium">Zelle / Wire (manual)</span>
              <span className="block text-xs text-black/55 mt-0.5">
                Agent receives instructions + reference code. You mark paid when funds land.
              </span>
            </span>
          </label>
        </fieldset>

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
            {submitting ? "Sending…" : primaryLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
