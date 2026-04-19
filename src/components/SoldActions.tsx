"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing, User } from "@/lib/types";
import { isOwner } from "@/lib/permissions";
import { formatPrice } from "@/lib/format";

/**
 * Mark Sold / Unmark Sold buttons for a published listing. Mounted alongside
 * `ListingActions` in the admin dashboard. Owner-only — hidden for non-owners
 * or for any listing that isn't in the published state.
 *
 * Also used inside the stale-listings queue, where the same mark-sold flow is
 * one of the quick actions.
 */
export function SoldActions({ user, listing }: { user: User; listing: Listing }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Hooks must run before any conditional return.
  if (!isOwner(user)) return null;
  if (listing.status !== "published") return null;

  const isSold = !!listing.sold_at;

  async function unmark() {
    if (
      !window.confirm(
        "Unmark this listing as sold? It will return to active state and the sale price + notes will be cleared."
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}/unsold`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.error || "Unmark failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "text-xs uppercase tracking-widest border px-3 py-1.5 disabled:opacity-30 transition-colors";

  return (
    <>
      {isSold ? (
        <button
          type="button"
          disabled={busy}
          onClick={unmark}
          className={btn + " border-black/20 hover:border-black/50"}
        >
          Unmark sold
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setModalOpen(true)}
          className={btn + " border-green-300 bg-green-50 text-green-900 hover:bg-green-100"}
        >
          Mark sold
        </button>
      )}
      {modalOpen && (
        <MarkSoldModal
          listing={listing}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function MarkSoldModal({
  listing,
  onClose,
  onSuccess
}: {
  listing: Listing;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // `YYYY-MM-DD` for the date input — toISOString gives UTC midnight, which is
  // fine because the server validation compares against end-of-today locally.
  const todayIso = new Date().toISOString().slice(0, 10);

  const [soldPriceUsd, setSoldPriceUsd] = useState("");
  const [soldAt, setSoldAt] = useState(todayIso);
  const [saleNotes, setSaleNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let priceNum: number | null = null;
    const trimmed = soldPriceUsd.trim();
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        setError("Sale price must be a positive whole number, or left blank.");
        return;
      }
      priceNum = n;
    }
    if (!soldAt) {
      setError("Sale date is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/listings/${listing.id}/sold`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sold_at: soldAt,
          sold_price_usd: priceNum,
          sale_notes: saleNotes.trim() || null
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Request failed.");
        return;
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-sold-title"
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
          <h2 id="mark-sold-title" className="font-display text-xl leading-snug">
            Mark "{listing.title}" as sold?
          </h2>
          <p className="text-xs text-black/50 mt-1">
            Originally listed at {formatPrice(listing.price_usd)}
          </p>
        </div>

        <div>
          <label htmlFor="sold-price" className="text-xs uppercase tracking-widest text-black/60 block mb-1">
            Sale price (USD)
          </label>
          <input
            id="sold-price"
            type="number"
            min={1}
            step={1}
            value={soldPriceUsd}
            onChange={(e) => setSoldPriceUsd(e.target.value)}
            className="w-full border border-black/20 px-3 py-2 text-sm"
            placeholder="12800000"
          />
          <p className="text-xs text-black/50 mt-1">
            Leave blank if not disclosed (NDA / off-market). Public page will show "Price undisclosed."
          </p>
        </div>

        <div>
          <label htmlFor="sold-at" className="text-xs uppercase tracking-widest text-black/60 block mb-1">
            Sale date
          </label>
          <input
            id="sold-at"
            type="date"
            required
            max={todayIso}
            value={soldAt}
            onChange={(e) => setSoldAt(e.target.value)}
            className="w-full border border-black/20 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="sale-notes" className="text-xs uppercase tracking-widest text-black/60 block mb-1">
            Internal notes
          </label>
          <textarea
            id="sale-notes"
            rows={3}
            value={saleNotes}
            onChange={(e) => setSaleNotes(e.target.value)}
            placeholder="Optional — e.g. confirmed by agent Jane Doe"
            className="w-full border border-black/20 px-3 py-2 text-sm"
          />
          <p className="text-xs text-black/50 mt-1">Not shown publicly.</p>
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
            className="text-xs uppercase tracking-widest bg-accent text-ink border border-accent px-3 py-2 hover:bg-ink hover:text-paper disabled:opacity-30"
          >
            {submitting ? "Marking…" : "Mark sold"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Single-purpose "still active" button — used in the stale-listings queue to
 * bump last_reviewed_at so the listing disappears from the queue for 90 days.
 */
export function StillActiveButton({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/reviewed`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.error || "Request failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="text-xs uppercase tracking-widest border border-black/20 px-3 py-1.5 disabled:opacity-30 hover:border-accent hover:text-accent transition-colors"
    >
      Still active
    </button>
  );
}
