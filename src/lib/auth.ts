import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "bc_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

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

export async function createSession() {
  const issuedAt = Date.now().toString();
  const signature = sign(issuedAt);
  const value = `${issuedAt}.${signature}`;
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

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return false;
  const [issuedAt, signature] = cookie.value.split(".");
  if (!issuedAt || !signature) return false;
  try {
    const expected = sign(issuedAt);
    if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
      return false;
    }
  } catch {
    return false;
  }
  const age = (Date.now() - Number(issuedAt)) / 1000;
  return age < MAX_AGE_SECONDS;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
