"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({
  initialName,
  initialEmail
}: {
  initialName: string;
  initialEmail: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dirty = name !== initialName || email.trim().toLowerCase() !== initialEmail;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    const res = await fetch("/api/admin/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email })
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to save profile.");
      return;
    }
    setSaved(true);
    // Refresh the server components so the header's "Signed in as …" line
    // picks up the new name/email without a hard reload.
    router.refresh();
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div>
        <label className={labelClass} htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="profile-email">
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Profile saved.</p>}
      <button
        type="submit"
        disabled={submitting || !dirty}
        className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
