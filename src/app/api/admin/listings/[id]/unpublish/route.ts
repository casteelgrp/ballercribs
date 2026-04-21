import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getListingByIdAdmin, unpublishListing } from "@/lib/db";
import { canUnpublish } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * POST /api/admin/listings/[id]/unpublish — owner-only. Moves a published
 * listing back to draft and clears published_at so it drops off the public
 * grid immediately. Reversible via a normal publish/approve flow.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const listing = await getListingByIdAdmin(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  // canUnpublish covers both "owner role" and "listing is published" — keeping
  // the check in the permissions module means the API and the client-side
  // button visibility can't drift apart.
  if (!canUnpublish(user, listing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await unpublishListing(id);
  if (!updated) {
    return NextResponse.json({ error: "Unpublish failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, listing: updated });
}
