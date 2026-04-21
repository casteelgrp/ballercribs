import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PasswordField } from "@/components/PasswordField";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-14">
          <Image
            src="/logo-black.png"
            alt="BallerCribs"
            width={480}
            height={96}
            className="h-20 w-auto sm:h-24"
            priority
          />
        </div>

        <h1 className="font-display text-3xl mb-2 text-center">Admin</h1>
        <p className="text-black/60 text-sm mb-10 text-center">Sign in to manage listings.</p>

        <form action="/api/admin/login" method="POST" className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="username"
              className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
            />
          </div>
          <PasswordField label="Password" name="password" required autoComplete="current-password" />
          {error && <p className="text-sm text-red-600">Invalid credentials.</p>}
          <button
            type="submit"
            className="w-full bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
