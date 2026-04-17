import { NextResponse } from "next/server";
import { getUserById, setUserActive, updateUserPassword } from "@/lib/db";
import { hashPassword, requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch (res) {
    return res as Response;
  }

  const { id: idStr } = await params;
  const targetId = Number(idStr);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const target = await getUserById(targetId);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let body: { action?: unknown; temp_password?: unknown; is_active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action || "");

  if (action === "reset_password") {
    const temp = String(body.temp_password || "");
    if (temp.length < 12) {
      return NextResponse.json(
        { error: "Temporary password must be at least 12 characters." },
        { status: 400 }
      );
    }
    const newHash = await hashPassword(temp);
    await updateUserPassword(targetId, newHash, true);
    return NextResponse.json({ ok: true });
  }

  if (action === "set_active") {
    const isActive = Boolean(body.is_active);
    if (!isActive && targetId === currentUser.id) {
      return NextResponse.json(
        { error: "You can't deactivate your own account." },
        { status: 400 }
      );
    }
    await setUserActive(targetId, isActive);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
