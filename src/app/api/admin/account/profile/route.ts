import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateUserProfile } from "@/lib/db";

export const runtime = "nodejs";

// Simple RFC-flavored email check. Not perfect, but keeps obviously bad input
// out of the users table; Postgres stores whatever we give it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  let body: { name?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (name.length < 1) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const updated = await updateUserProfile(user.id, { name, email });
    return NextResponse.json({
      ok: true,
      user: { id: updated.id, name: updated.name, email: updated.email }
    });
  } catch (err) {
    const e = err as { code?: string } | null;
    if (e?.code === "23505") {
      return NextResponse.json(
        { error: "That email is already in use by another account." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
