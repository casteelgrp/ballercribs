import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { countListingsByPartner, getPartnerById } from "@/lib/db";
import { PartnerForm } from "@/components/admin/PartnerForm";

export const dynamic = "force-dynamic";

export default async function EditPartnerPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.must_change_password) redirect("/admin/account?force=1");
  if (user.role !== "owner") notFound();

  const { id } = await params;
  const partner = await getPartnerById(id).catch(() => null);
  if (!partner) notFound();

  // Count surfaces only this partner's count for the mode-switch
  // confirm dialog ("This partner has N rentals using inquiry-form
  // mode…"). One Promise.all to keep the page render flat.
  const counts = await countListingsByPartner().catch(
    () => ({} as Record<string, number>)
  );
  const attachedRentalCount = counts[partner.id] ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link
          href="/admin/partners"
          className="text-xs uppercase tracking-widest text-black/55 hover:text-accent"
        >
          ← All partners
        </Link>
        <h2 className="font-display text-2xl mt-2">Edit {partner.name}</h2>
        {attachedRentalCount > 0 && (
          <p className="text-xs text-black/55 mt-1">
            {attachedRentalCount} rental
            {attachedRentalCount === 1 ? "" : "s"} attached.
          </p>
        )}
      </div>

      <PartnerForm
        existing={partner}
        attachedRentalCount={attachedRentalCount}
      />
    </div>
  );
}
