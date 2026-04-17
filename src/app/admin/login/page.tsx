import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function AdminLoginPage(
  { searchParams }: { searchParams: Promise<{ error?: string }> }
) {
  if (await isAuthenticated()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="max-w-md mx-auto px-4 py-24">
      <h1 className="font-display text-3xl mb-2">Admin</h1>
      <p className="text-black/60 text-sm mb-8">Enter the admin password to continue.</p>

      <form action="/api/admin/login" method="POST" className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">Incorrect password.</p>
        )}
        <button
          type="submit"
          className="w-full bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
