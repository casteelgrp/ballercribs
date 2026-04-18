import { NextResponse } from "next/server";
import { unarchiveAgentInquiry } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

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
  const ok = await unarchiveAgentInquiry(id);
  if (!ok) {
    return NextResponse.json({ error: "Agent inquiry not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
