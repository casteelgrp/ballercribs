"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Destination, DestinationCounts } from "@/lib/types";

/**
 * Edit + Delete cluster for a destination row in the /admin/destinations
 * list. Mirrors the ListingActions vocabulary: text-only buttons, red-
 * hover treatment on Delete, window.confirm() with a count-aware
 * warning, router.refresh() on success.
 *
 * Confirm copy intentionally duplicates the edit-page form's logic —
 * two callers, ten lines, not worth a shared helper. Keep the two in
 * lockstep if either changes.
 */
export function DestinationRowActions({
  destination,
  counts
}: {
  destination: Destination;
  counts: DestinationCounts;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const total = counts.listings + counts.rentals + counts.blog_posts;
    const message =
      total > 0
        ? `${counts.listings} listing${counts.listings === 1 ? "" : "s"}, ${counts.rentals} rental${counts.rentals === 1 ? "" : "s"}, ${counts.blog_posts} blog post${counts.blog_posts === 1 ? "" : "s"} are tagged to this destination. They will become untagged but not deleted. Continue?`
        : `Delete ${destination.name}? This cannot be undone.`;
    if (!window.confirm(message)) return;

    setBusy(true);
    const res = await fetch(`/api/admin/destinations/${destination.id}`, {
      method: "DELETE"
    });
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
    <div className="flex justify-end gap-1.5">
      <a
        href={`/admin/destinations/${destination.id}/edit`}
        className={btn + " hover:border-accent hover:text-accent inline-block"}
      >
        Edit
      </a>
      <button
        type="button"
        disabled={busy}
        onClick={handleDelete}
        className={btn + " hover:border-red-500 hover:text-red-600"}
      >
        Delete
      </button>
    </div>
  );
}
