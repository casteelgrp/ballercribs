import { NextResponse } from "next/server";
import {
  countUsers,
  createUser,
  getUserByEmailWithHash,
  updateLastLogin
} from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

const LOGIN_FAIL_URL = "/admin/login?error=1";

export async function POST(req: Request) {
  const formData = await req.formData();
  const emailInput = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!emailInput || !password) {
    return NextResponse.redirect(new URL(LOGIN_FAIL_URL, req.url), 303);
  }

  // Bootstrap: first-ever login creates the owner from env vars.
  const existingCount = await countUsers();
  if (existingCount === 0) {
    const expectedEmail = String(process.env.INQUIRY_NOTIFICATION_EMAIL || "")
      .trim()
      .toLowerCase();
    const expectedPassword = String(process.env.ADMIN_PASSWORD || "");
    if (!expectedEmail || !expectedPassword) {
      console.error("Bootstrap blocked: INQUIRY_NOTIFICATION_EMAIL or ADMIN_PASSWORD missing.");
      return NextResponse.redirect(new URL(LOGIN_FAIL_URL, req.url), 303);
    }
    if (emailInput !== expectedEmail || password !== expectedPassword) {
      return NextResponse.redirect(new URL(LOGIN_FAIL_URL, req.url), 303);
    }
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email: emailInput,
      name: "Jay",
      role: "owner",
      password_hash: passwordHash,
      must_change_password: false
    });
    await updateLastLogin(user.id);
    await createSession(user.id);
    return NextResponse.redirect(new URL("/admin", req.url), 303);
  }

  // Normal login.
  const user = await getUserByEmailWithHash(emailInput);
  const passwordMatches = await verifyPassword(
    password,
    user && user.is_active ? user.password_hash : null
  );
  if (!user || !user.is_active || !passwordMatches) {
    return NextResponse.redirect(new URL(LOGIN_FAIL_URL, req.url), 303);
  }

  await updateLastLogin(user.id);
  await createSession(user.id);

  const target = user.must_change_password ? "/admin/account?force=1" : "/admin";
  return NextResponse.redirect(new URL(target, req.url), 303);
}
