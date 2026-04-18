"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/types";

type Props = {
  listing: Listing;
  /** Display name of whoever submitted, for the toast after send-back. */
  submitterName: string | null;
};

export function ReviewActions({ listing, submitterName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showSendBack, setShowSendBack] = useState(false);
  const [note, setNote] = useState("");

  async function transition(action: "approve" | "send_back_to_draft") {
    setBusy(true);
    const res = await fetch(`/api/admin/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error || "Action failed.");
      return;
    }
    if (action === "approve") {
      router.push(`/admin?toast=approved&title=${encodeURIComponent(listing.title)}`);
    } else {
      const who = submitterName ?? "the submitter";
      router.push(`/admin?toast=sent_back&who=${encodeURIComponent(who)}`);
    }
    router.refresh();
  }

  return (
    <div className="border border-amber-300 bg-amber-50 px-4 py-4 mb-6">
      <p className="text-sm text-amber-900 mb-3">
        <strong>This listing is awaiting your review.</strong>
        {submitterName && <> Submitted by {submitterName}.</>} Make any edits and save before
        approving — saved changes are part of the published version.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("approve")}
          className="bg-accent text-ink px-5 py-2.5 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
        >
          Approve &amp; publish
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowSendBack((v) => !v)}
          className="border border-amber-700 text-amber-900 px-5 py-2.5 text-sm uppercase tracking-widest hover:bg-amber-700 hover:text-white transition-colors disabled:opacity-50"
        >
          Send back to draft
        </button>
      </div>
      {showSendBack && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs uppercase tracking-widest text-amber-900">
            Note for {submitterName ?? "submitter"} (optional, not yet emailed — placeholder for v2)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-700 focus:outline-none"
            placeholder="What needs to change before this can go live?"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => transition("send_back_to_draft")}
            className="bg-amber-700 text-white px-4 py-2 text-sm uppercase tracking-widest hover:bg-amber-800 transition-colors disabled:opacity-50"
          >
            Confirm send-back
          </button>
        </div>
      )}
    </div>
  );
}
