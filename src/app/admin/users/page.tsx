import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { InviteUserForm } from "@/components/InviteUserForm";
import { UsersTable } from "@/components/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.must_change_password) redirect("/admin/account?force=1");
  if (user.role !== "owner") notFound();

  const users = await listUsers();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <h1 className="font-display text-3xl">Users</h1>
        <Link href="/admin" className="text-sm underline underline-offset-4 hover:text-accent">
          Back to admin
        </Link>
      </div>

      <section className="mb-12">
        <h2 className="font-display text-2xl mb-1">Invite user</h2>
        <p className="text-sm text-black/60 mb-6">
          Pick a temporary password and share it with them via Signal, WhatsApp, or in person.
          They'll be forced to change it on first login.
        </p>
        <InviteUserForm />
      </section>

      <section>
        <h2 className="font-display text-2xl mb-6">All users ({users.length})</h2>
        <UsersTable users={users} currentUserId={user.id} />
      </section>
    </div>
  );
}
