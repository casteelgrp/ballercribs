import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getUserById } from "./db";
import type { User } from "./types";

const COOKIE_NAME = "bc_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Used when a login misses (no user / inactive) so password-verify timing is constant.
// This is a real bcrypt hash of a random string — nothing ever matches it.
const DUMMY_HASH = "$2b$12$fONR4oHteXe.4haGwnoEmeNmOWEOE/FBen01GaOXAH9GxRsgMpFea";

export const BCRYPT_COST = 12;

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET is not set or too short (min 16 chars).");
  }
  return s;
}

function sign(value: string): string {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(value);
  return hmac.digest("hex");
}

export async function createSession(userId: number) {
  const issuedAt = Date.now().toString();
  const payload = `${userId}.${issuedAt}`;
  const signature = sign(payload);
  const value = `${payload}.${signature}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

function parseCookie(raw: string | undefined): { userId: number; issuedAt: number } | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userIdStr, issuedAtStr, signature] = parts;
  const userId = Number(userIdStr);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(userId) || !Number.isFinite(issuedAt)) return null;

  const payload = `${userIdStr}.${issuedAtStr}`;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  const ageSeconds = (Date.now() - issuedAt) / 1000;
  if (ageSeconds < 0 || ageSeconds > MAX_AGE_SECONDS) return null;

  return { userId, issuedAt };
}

/** Returns the logged-in user, or null if no valid session or user is inactive. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const parsed = parseCookie(cookie?.value);
  if (!parsed) return null;
  const user = await getUserById(parsed.userId);
  if (!user || !user.is_active) return null;
  return user;
}

/** For API routes: returns user or throws a Response the caller can return directly. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }
  return user;
}

/**
 * For admin page components: returns the user, or redirects to /admin/login
 * if not authenticated, or to /admin/account?force=1 if the user must change
 * their password before doing anything else. Do NOT call from /admin/account
 * itself — that would cause a loop.
 */
export async function requirePageUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.must_change_password) redirect("/admin/account?force=1");
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "owner") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }
  return user;
}

/** Hash a plaintext password with the standard cost. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verify a plaintext password against a stored hash.
 * Pass `null` for hash when the user lookup missed — we still run a compare
 * against a dummy hash so attackers can't use timing to enumerate emails.
 */
export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
