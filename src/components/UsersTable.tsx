"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";

export function UsersTable({ users, currentUserId }: { users: User[]; currentUserId: number }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);

  async function resetPassword(user: User) {
    const temp = window.prompt(
      `Set a new temporary password for ${user.email} (min 12 chars). They'll be forced to change it on next login.`
    );
    if (!temp) return;
    if (temp.length < 12) {
      window.alert("Temporary password must be at least 12 characters.");
      return;
    }
    setBusyId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reset_password", temp_password: temp })
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error || "Failed to reset password.");
      return;
    }
    window.alert(
      `Password reset for ${user.email}. Share the new temporary password with them out-of-band.`
    );
    router.refresh();
  }

  async function toggleActive(user: User) {
    if (user.id === currentUserId) {
      window.alert("You can't deactivate your own account.");
      return;
    }
    const verb = user.is_active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${user.email}?`)) return;
    setBusyId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set_active", is_active: !user.is_active })
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error || "Failed to update user.");
      return;
    }
    router.refresh();
  }

  async function deleteUser(user: User) {
    if (user.id === currentUserId) {
      window.alert("You can't delete your own account.");
      return;
    }
    // Spell out the reattribution so admins aren't surprised when a
    // deleted user's listings / blog posts / payments suddenly show
    // up under their own attribution. Audit-trail rows (review and
    // pipeline events) still null out — that's historical fact, not
    // ownership.
    if (
      !window.confirm(
        `Delete user ${user.email}? Their listings, blog posts, and payments will be reattributed to you. This cannot be undone.`
      )
    )
      return;
    setBusyId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Last-owner / self-delete server errors surface here verbatim.
      window.alert(data?.error || "Failed to delete user.");
      return;
    }
    router.refresh();
  }

  if (users.length === 0) {
    return <p className="text-sm text-black/50">No users yet.</p>;
  }

  return (
    <div className="border border-black/10 bg-white divide-y divide-black/10">
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-4 p-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {u.name}
              <span className="ml-2 text-[10px] uppercase tracking-widest bg-black/5 px-1.5 py-0.5">
                {u.role}
              </span>
              {!u.is_active && (
                <span className="ml-2 text-[10px] uppercase tracking-widest bg-red-100 text-red-700 px-1.5 py-0.5">
                  inactive
                </span>
              )}
              {u.must_change_password && (
                <span className="ml-2 text-[10px] uppercase tracking-widest bg-accent/20 text-accent px-1.5 py-0.5">
                  must reset
                </span>
              )}
            </p>
            <p className="text-xs text-black/60">{u.email}</p>
            <p className="text-xs text-black/40 mt-1">
              {u.last_login_at
                ? `Last login ${new Date(u.last_login_at).toLocaleString()}`
                : "Never logged in"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => resetPassword(u)}
              disabled={busyId === u.id}
              className="text-xs uppercase tracking-widest border border-black/20 px-3 py-2 hover:border-accent hover:text-accent disabled:opacity-50"
            >
              Reset password
            </button>
            <button
              onClick={() => toggleActive(u)}
              disabled={busyId === u.id || u.id === currentUserId}
              className="text-xs uppercase tracking-widest border border-black/20 px-3 py-2 hover:border-black/50 disabled:opacity-30"
            >
              {u.is_active ? "Deactivate" : "Reactivate"}
            </button>
            {/* Self-delete guard mirrors the deactivate pattern —
                disabled state on the row prevents an owner from
                accidentally deleting their own account. Server-side
                guard in /api/admin/users/[id] DELETE catches it
                regardless if the button is somehow re-enabled. */}
            <button
              onClick={() => deleteUser(u)}
              disabled={busyId === u.id || u.id === currentUserId}
              className="text-xs uppercase tracking-widest border border-black/20 px-3 py-2 hover:border-red-500 hover:text-red-600 disabled:opacity-30"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
