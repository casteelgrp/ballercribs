"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { availableTransitions } from "@/lib/permissions";
import type { Listing, User } from "@/lib/types";

type Action =
  | "submit_for_review"
  | "publish"
  | "approve"
  | "send_back_to_draft"
  | "archive"
  | "restore";

const CONFIRMS: Partial<Record<Action, string>> = {
  archive: "Archive this listing? It will be hidden from the public site and the default admin view.",
  send_back_to_draft: "Send this listing back to draft? The submitter will need to re-submit."
};

export function ListingActions({ user, listing }: { user: User; listing: Listing }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const t = availableTransitions(user, listing);

  async function transition(action: Action) {
    const confirmMsg = CONFIRMS[action];
    if (confirmMsg && !window.confirm(confirmMsg)) return;
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
    router.refresh();
  }

  async function deleteListing() {
    if (
      !window.confirm(
        `Permanently delete "${listing.title}"? This cannot be undone. Inquiries on this listing will be detached but kept.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/admin/listings/${listing.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error || "Delete failed.");
      return;
    }
    router.refresh();
  }

  const btn =
    "text-xs uppercase tracking-widest border border-black/20 px-3 py-1.5 disabled:opacity-30 transition-colors";

  return (
    <div className="flex flex-wrap gap-1.5">
      {t.edit && (
        <a
          href={`/admin/listings/${listing.id}/edit`}
          className={btn + " hover:border-accent hover:text-accent inline-block"}
        >
          Edit
        </a>
      )}
      {t.submitForReview && (
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("submit_for_review")}
          className={btn + " hover:border-accent hover:text-accent"}
        >
          Submit for review
        </button>
      )}
      {t.publishDirect && listing.status !== "review" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("publish")}
          className={btn + " bg-accent text-ink border-accent hover:bg-ink hover:text-paper"}
        >
          Publish now
        </button>
      )}
      {t.approve && (
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("approve")}
          className={btn + " bg-accent text-ink border-accent hover:bg-ink hover:text-paper"}
        >
          Approve & publish
        </button>
      )}
      {t.sendBack && (
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("send_back_to_draft")}
          className={btn + " hover:border-black/50"}
        >
          Send back to draft
        </button>
      )}
      {t.archive && (
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("archive")}
          className={btn + " hover:border-black/50"}
        >
          Archive
        </button>
      )}
      {t.restore && (
        <button
          type="button"
          disabled={busy}
          onClick={() => transition("restore")}
          className={btn + " hover:border-accent hover:text-accent"}
        >
          Restore to draft
        </button>
      )}
      {t.delete && (
        <button
          type="button"
          disabled={busy}
          onClick={deleteListing}
          className={btn + " hover:border-red-500 hover:text-red-600"}
        >
          Delete
        </button>
      )}
    </div>
  );
}
