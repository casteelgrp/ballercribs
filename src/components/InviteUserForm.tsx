"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "./PasswordField";

type InviteResult =
  | { kind: "sent"; email: string }
  | { kind: "fallback"; email: string; tempPassword: string; emailError: string };

export function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [role, setRole] = useState<"user" | "owner">("user");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  function generatePassword() {
    // 24 url-safe chars from web crypto
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const b64 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    setTempPassword(b64);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (tempPassword.length < 12) {
      setError("Temporary password must be at least 12 characters.");
      return;
    }
    setSubmitting(true);
    const submittedEmail = email.trim();
    const submittedTempPassword = tempPassword;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: submittedEmail,
        name: name.trim(),
        role,
        temp_password: submittedTempPassword
      })
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to invite user.");
      return;
    }
    const data: {
      ok: true;
      email_sent: boolean;
      email_error: string | null;
      fallback_temp_password: string | null;
    } = await res.json();
    if (data.email_sent) {
      setResult({ kind: "sent", email: submittedEmail });
    } else {
      setResult({
        kind: "fallback",
        email: submittedEmail,
        tempPassword: data.fallback_temp_password ?? submittedTempPassword,
        emailError: data.email_error ?? "Unknown error"
      });
    }
    setEmail("");
    setName("");
    setTempPassword("");
    setRole("user");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-black/10 bg-white p-6">
      {result?.kind === "sent" && (
        <div className="border border-green-300 bg-green-50 text-green-900 px-4 py-3 text-sm">
          Invite sent to <strong>{result.email}</strong>. They'll receive login instructions
          shortly.
        </div>
      )}
      {result?.kind === "fallback" && (
        <div className="border border-amber-400 bg-amber-50 text-amber-900 px-4 py-3 text-sm space-y-2">
          <p>
            <strong>Email send failed</strong> ({result.emailError}). Please share the temporary
            password with <strong>{result.email}</strong> manually.
          </p>
          <p>
            Temporary password:{" "}
            <code className="font-mono bg-white px-2 py-1 border border-amber-200">
              {result.tempPassword}
            </code>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
            Email
          </label>
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
          <div className="flex items-end justify-between">
            {/* Label is rendered by PasswordField; this row holds the generate-link */}
          </div>
          <PasswordField
            label="Temporary password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            required
            placeholder="min 12 chars — emailed to the user"
            className="font-mono text-sm"
          />
          <button
            type="button"
            onClick={generatePassword}
            className="mt-1 text-xs underline underline-offset-2 text-black/60 hover:text-accent"
          >
            Generate a strong one
          </button>
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
        We'll email the user with their login + this password. They'll be forced to change it on
        first login.
      </p>
    </form>
  );
}
