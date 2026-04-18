import { NextResponse } from "next/server";
import { createUser, getUserByEmailWithHash, listUsers } from "@/lib/db";
import { hashPassword, requireOwner } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  let inviter;
  try {
    inviter = await requireOwner();
  } catch (res) {
    return res as Response;
  }

  let body: { email?: unknown; name?: unknown; role?: unknown; temp_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const role = body.role === "owner" ? "owner" : "user";
  const tempPassword = String(body.temp_password || "");

  if (!email || !name) {
    return NextResponse.json({ error: "Email and name are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  if (tempPassword.length < 12) {
    return NextResponse.json(
      { error: "Temporary password must be at least 12 characters." },
      { status: 400 }
    );
  }

  const existing = await getUserByEmailWithHash(email);
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(tempPassword);
  const newUser = await createUser({
    email,
    name,
    role,
    password_hash: passwordHash,
    must_change_password: true
  });

  // Best-effort invite email. We always report success on user-creation; email
  // result is communicated separately so the UI can show "share manually" fallback.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
  const loginUrl = `${siteUrl.replace(/\/$/, "")}/admin/login`;
  const emailResult = await sendInviteEmail({
    toEmail: email,
    toName: name,
    tempPassword,
    inviterEmail: inviter.email,
    inviterName: inviter.name,
    loginUrl
  });

  return NextResponse.json({
    ok: true,
    id: newUser.id,
    email_sent: emailResult.ok,
    email_error: emailResult.ok ? null : emailResult.error ?? "Unknown error",
    // We send back temp password ONLY if email failed, so the owner can share manually.
    // (Email succeeded → no need to display, reduce on-screen exposure.)
    fallback_temp_password: emailResult.ok ? null : tempPassword
  });
}
