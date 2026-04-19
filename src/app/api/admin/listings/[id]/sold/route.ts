import { NextResponse } from "next/server";
import { getListingByIdAdmin, markListingSold } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/listings/[id]/sold
 *
 * Body: { sold_at: string (YYYY-MM-DD or ISO), sold_price_usd: number | null, sale_notes?: string | null }
 *
 * Mark a listing as sold. sold_price_usd may be null (NDA / undisclosed — public
 * page renders "SOLD · Price undisclosed"). sold_at must be a valid date and
 * not in the future.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const listing = await getListingByIdAdmin(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  let body: { sold_at?: unknown; sold_price_usd?: unknown; sale_notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── sold_at: required, valid date, not in the future ──────────────────────
  if (typeof body.sold_at !== "string" || !body.sold_at.trim()) {
    return NextResponse.json({ error: "Sale date is required." }, { status: 400 });
  }
  const soldAt = new Date(body.sold_at);
  if (Number.isNaN(soldAt.getTime())) {
    return NextResponse.json({ error: "Sale date is not a valid date." }, { status: 400 });
  }
  // Compare against end-of-today so a date-only input from a client in a
  // later timezone (already at tomorrow's midnight UTC) isn't rejected.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (soldAt.getTime() > endOfToday.getTime()) {
    return NextResponse.json({ error: "Sale date cannot be in the future." }, { status: 400 });
  }

  // ── sold_price_usd: optional, positive integer if provided ────────────────
  let soldPriceUsd: number | null = null;
  if (body.sold_price_usd !== null && body.sold_price_usd !== undefined && body.sold_price_usd !== "") {
    const n = Number(body.sold_price_usd);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      return NextResponse.json(
        { error: "Sale price must be a positive whole number, or left blank." },
        { status: 400 }
      );
    }
    soldPriceUsd = n;
  }

  // ── sale_notes: optional, trimmed ─────────────────────────────────────────
  const saleNotes =
    typeof body.sale_notes === "string" && body.sale_notes.trim()
      ? body.sale_notes.trim()
      : null;

  const updated = await markListingSold(id, {
    sold_at: soldAt.toISOString(),
    sold_price_usd: soldPriceUsd,
    sale_notes: saleNotes
  });
  if (!updated) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, listing: updated });
}
