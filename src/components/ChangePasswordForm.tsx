"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm({ force }: { force: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next })
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to change password.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      {force && (
        <div className="border border-accent/40 bg-accent/10 text-ink text-sm p-3">
          You must set a new password before continuing.
        </div>
      )}
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Current password
        </label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          New password (min 12 chars)
        </label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Confirm new password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
