import { NextResponse } from "next/server";
import { getUserByIdWithHash, updateUserPassword } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  let body: { current_password?: unknown; new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");

  if (newPassword.length < 12) {
    return NextResponse.json(
      { error: "New password must be at least 12 characters." },
      { status: 400 }
    );
  }

  const withHash = await getUserByIdWithHash(user.id);
  if (!withHash) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const ok = await verifyPassword(currentPassword, withHash.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  await updateUserPassword(user.id, newHash, false);
  return NextResponse.json({ ok: true });
}
