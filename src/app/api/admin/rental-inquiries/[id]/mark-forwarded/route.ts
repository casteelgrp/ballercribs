import { NextResponse } from "next/server";
import { markRentalInquiryForwarded } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Manual-forward stamp for a rental inquiry. The inbox's "Mark
 * forwarded" button hits this; the helper guards on
 * forwarded_to_partner_at IS NULL so a double-click doesn't move
 * the timestamp forward. There's no unmark route in v1 — admin
 * reverses via DB if it ever happens (spec).
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const ok = await markRentalInquiryForwarded(id);
  if (!ok) {
    // Either the row doesn't exist OR it was already forwarded.
    // Surfacing 404 either way keeps the route's contract simple —
    // the UI just refreshes the page state to reflect reality.
    return NextResponse.json(
      { error: "Rental inquiry not found or already forwarded." },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true });
}
