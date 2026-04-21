import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/permissions";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Unauthenticated (e.g. /admin/login) — the page handles its own redirect.
  // Forced password change — only /admin/account?force=1 is reachable; hide the
  // tab nav so clicking around doesn't fight the redirect guard on other pages.
  if (!user || user.must_change_password) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">The Desk</h1>
          <p className="text-sm text-black/60 mt-1">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button
            type="submit"
            className="text-sm underline underline-offset-4 hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 border-b border-black/10">
        <AdminTabs isOwner={isOwner(user)} />
      </div>
      {children}
    </>
  );
}
