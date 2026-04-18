"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "buyer" | "agent";

/**
 * Archive / Unarchive / Delete buttons for an inquiry row. Shared between
 * buyer inquiries and agent inquiries via the `kind` prop — same action
 * shape, different endpoint prefix.
 *
 * Archive/Unarchive fire immediately (reversible). Delete uses native
 * window.confirm — matches the pattern in ListingActions / HeroPhotosManager,
 * avoids pulling in a modal library for one use.
 */
export function InquiryActions({
  id,
  kind,
  archived
}: {
  id: number;
  kind: Kind;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const basePath =
    kind === "buyer"
      ? `/api/admin/inquiries/${id}`
      : `/api/admin/agent-inquiries/${id}`;

  async function call(method: "PATCH" | "DELETE", path = "") {
    setBusy(true);
    try {
      const res = await fetch(basePath + path, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.error || `Failed (${res.status}).`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onArchive() {
    await call("PATCH", "/archive");
  }

  async function onUnarchive() {
    await call("PATCH", "/unarchive");
  }

  async function onDelete() {
    if (
      !window.confirm("Permanently delete this inquiry? This cannot be undone.")
    )
      return;
    await call("DELETE");
  }

  const btn =
    "text-[11px] uppercase tracking-widest border px-2.5 py-1 disabled:opacity-30 transition-colors";

  return (
    <div className="flex flex-wrap gap-1.5">
      {archived ? (
        <button
          type="button"
          disabled={busy}
          onClick={onUnarchive}
          className={btn + " border-black/20 hover:border-accent hover:text-accent"}
        >
          Unarchive
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className={btn + " border-black/20 hover:border-black/50"}
        >
          Archive
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className={btn + " border-red-200 text-red-700 hover:border-red-500 hover:bg-red-50"}
      >
        Delete
      </button>
    </div>
  );
}
