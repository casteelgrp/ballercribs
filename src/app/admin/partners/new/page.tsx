import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PartnerForm } from "@/components/admin/PartnerForm";

export const dynamic = "force-dynamic";

export default async function NewPartnerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.must_change_password) redirect("/admin/account?force=1");
  if (user.role !== "owner") notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link
          href="/admin/partners"
          className="text-xs uppercase tracking-widest text-black/55 hover:text-accent"
        >
          ← All partners
        </Link>
        <h2 className="font-display text-2xl mt-2">New partner</h2>
      </div>

      <PartnerForm existing={null} />
    </div>
  );
}
