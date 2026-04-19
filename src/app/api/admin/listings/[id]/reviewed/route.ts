import { NextResponse } from "next/server";
import { markListingReviewed } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/listings/[id]/reviewed
 *
 * Bumps last_reviewed_at = NOW(). Fired by the "Still active" button in the
 * admin stale-listing queue; removes the listing from the queue for the next
 * 90 days.
 */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const ok = await markListingReviewed(id);
  if (!ok) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
