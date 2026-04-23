import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { ListingForm } from "@/components/ListingForm";
import { isOwner } from "@/lib/permissions";
import { AdminFormCard, AdminFormShell } from "@/components/admin/AdminFormShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New listing — BallerCribs" };

export default async function AdminNewListingPage() {
  const user = await requirePageUser();
  return (
    <AdminFormShell>
      <section>
        <h2 className="font-display text-2xl mb-1">New listing</h2>
        <p className="text-sm text-black/60 mb-6">
          {isOwner(user)
            ? "Save as draft, submit for review, or publish directly."
            : "Save as draft to keep editing, or submit for review when it's ready."}
        </p>
        <AdminFormCard>
          <ListingForm currentUser={user} />
        </AdminFormCard>
      </section>
    </AdminFormShell>
  );
}
