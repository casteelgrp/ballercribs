import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@vercel/postgres";
import { requirePageUser } from "@/lib/auth";
import { getListingByIdAdmin } from "@/lib/db";
import { canApprove, canEdit, canViewListing, isOwner } from "@/lib/permissions";
import { ListingForm } from "@/components/ListingForm";
import { ReviewActions } from "@/components/ReviewActions";
import { ListingActions } from "@/components/ListingActions";
import { AdminFormCard, AdminFormShell } from "@/components/admin/AdminFormShell";

export const dynamic = "force-dynamic";

async function fetchSubmitterName(userId: number | null): Promise<string | null> {
  if (userId === null) return null;
  const { rows } = await sql`SELECT name FROM users WHERE id = ${userId} LIMIT 1;`;
  return rows[0]?.name ?? null;
}

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
  if (!canViewListing(user, listing)) notFound();

  const editable = canEdit(user, listing);
  const showReviewActions = canApprove(user, listing);
  const submitterName = showReviewActions
    ? await fetchSubmitterName(listing.created_by_user_id)
    : null;

  // Status banner copy for non-editors viewing their own non-draft listing.
  const showOwnStatusBanner = !editable && !isOwner(user);
  const ownStatusMessage = (() => {
    switch (listing.status) {
      case "review":
        return "Awaiting editor approval. You'll be able to edit again if it's sent back to draft.";
      case "published":
        return "Published. Visit the public page to see how it looks live.";
      case "archived":
        return "Archived. Hidden from the public site.";
      default:
        return null;
    }
  })();

  return (
    <AdminFormShell>
      <div className="mb-8">
        <h2 className="font-display text-2xl">
          {editable ? "Edit listing" : "View listing"}
        </h2>
        <p className="text-sm text-black/60 mt-1">
          {listing.title} · status: {listing.status}
        </p>
      </div>

      {showReviewActions && (
        <ReviewActions listing={listing} submitterName={submitterName} />
      )}

      {showOwnStatusBanner && ownStatusMessage && (
        <div className="border border-black/10 bg-black/5 px-4 py-3 mb-6 text-sm text-black/70 flex items-center justify-between gap-4 flex-wrap">
          <span>{ownStatusMessage}</span>
          {listing.status === "published" && (
            <Link
              href={`/listings/${listing.slug}`}
              className="text-sm underline underline-offset-4 hover:text-accent"
            >
              View public page →
            </Link>
          )}
        </div>
      )}

      <AdminFormCard>
        <ListingForm currentUser={user} existing={listing} readOnly={!editable} />
      </AdminFormCard>

      {/* Owner-only secondary actions (archive, delete, etc.) below the form. */}
      {isOwner(user) && (
        <div className="mt-6">
          <ListingActions user={user} listing={listing} />
        </div>
      )}
    </AdminFormShell>
  );
}
