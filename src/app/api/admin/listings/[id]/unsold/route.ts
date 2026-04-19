import { NextResponse } from "next/server";
import { unmarkListingSold } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

/** PATCH /api/admin/listings/[id]/unsold — clears sold fields back to NULL. */
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

  const updated = await unmarkListingSold(id);
  if (!updated) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, listing: updated });
}
