import { NextResponse } from "next/server";
import {
  countOwners,
  deleteUser,
  getUserById,
  setUserActive,
  updateUserPassword
} from "@/lib/db";
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Self-delete guard. The PATCH "set_active" path enforces the same
  // rule for deactivation; delete is the harder destructive form, so
  // it gets the same gate.
  if (target.id === currentUser.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 }
    );
  }

  // Last-owner guard. Deleting the only owner would leave the project
  // unmanageable — no one can promote the next user, no one can flip
  // permissions. countOwners is pre-delete; we check that the *post-
  // delete* count would still be ≥ 1 when the target is an owner.
  if (target.role === "owner") {
    const owners = await countOwners();
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Can't delete the last owner. Promote another user first." },
        { status: 400 }
      );
    }
  }

  try {
    const ok = await deleteUser(targetId);
    if (!ok) {
      return NextResponse.json({ error: "Delete failed." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete user:", err);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
