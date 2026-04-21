import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { ListingForm } from "@/components/ListingForm";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New listing — BallerCribs" };

export default async function AdminNewListingPage() {
  const user = await requirePageUser();
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <section>
        <h2 className="font-display text-2xl mb-1">New listing</h2>
        <p className="text-sm text-black/60 mb-6">
          {isOwner(user)
            ? "Save as draft, submit for review, or publish directly."
            : "Save as draft to keep editing, or submit for review when it's ready."}
        </p>
        <div className="border border-black/10 bg-white p-6">
          <ListingForm currentUser={user} />
        </div>
      </section>
    </div>
  );
}
