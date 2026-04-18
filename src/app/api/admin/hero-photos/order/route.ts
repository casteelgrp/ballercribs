import { NextResponse } from "next/server";
import { setHeroPhotoOrders } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Bulk-update display_order. Body: { orders: Array<{ id: number; order: number }> }.
 * Called by the admin manager after a drag-end (debounced 500ms).
 */
export async function PATCH(req: Request) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  let body: { orders?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.orders)) {
    return NextResponse.json({ error: "Provide { orders: [{id, order}, …] }." }, { status: 400 });
  }

  const cleaned: Array<{ id: number; order: number }> = [];
  for (const entry of body.orders as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { id?: unknown; order?: unknown };
    const id = Number(e.id);
    const order = Number(e.order);
    if (!Number.isFinite(id) || !Number.isFinite(order)) continue;
    cleaned.push({ id, order });
  }

  await setHeroPhotoOrders(cleaned);
  return NextResponse.json({ ok: true, updated: cleaned.length });
}
