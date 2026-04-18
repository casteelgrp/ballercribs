import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getListingByIdAdmin } from "@/lib/db";
import { canEdit } from "@/lib/permissions";
import { ListingForm } from "@/components/ListingForm";

export const dynamic = "force-dynamic";

export default async function AdminEditListingPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const listing = await getListingByIdAdmin(id);
  if (!listing) notFound();
  if (!canEdit(user, listing)) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Edit listing</h1>
          <p className="text-sm text-black/60 mt-1">
            {listing.title} · status: {listing.status}
          </p>
        </div>
        <Link href="/admin" className="text-sm underline underline-offset-4 hover:text-accent">
          Back to admin
        </Link>
      </div>

      <div className="border border-black/10 bg-white p-6">
        <ListingForm currentUser={user} existing={listing} />
      </div>
    </div>
  );
}
