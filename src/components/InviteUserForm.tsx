"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [role, setRole] = useState<"user" | "owner">("user");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tempPassword.length < 12) {
      setError("Temporary password must be at least 12 characters.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim(),
        role,
        temp_password: tempPassword
      })
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to invite user.");
      return;
    }
    setEmail("");
    setName("");
    setTempPassword("");
    setRole("user");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-black/10 bg-white p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-black/20 px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-black/20 px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
            Temporary password
          </label>
          <input
            type="text"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            required
            placeholder="min 12 chars — share out-of-band"
            className="w-full border border-black/20 px-3 py-2 focus:border-accent focus:outline-none font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "owner")}
            className="w-full border border-black/20 px-3 py-2 focus:border-accent focus:outline-none bg-white"
          >
            <option value="user">User</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
      >
        {submitting ? "Inviting…" : "Invite user"}
      </button>
      <p className="text-xs text-black/50">
        The new user will be forced to change this password on first login.
      </p>
    </form>
  );
}
