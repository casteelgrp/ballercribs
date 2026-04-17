import { NextResponse } from "next/server";
import { checkPassword, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const password = String(formData.get("password") || "");

  if (!checkPassword(password)) {
    return NextResponse.redirect(new URL("/admin/login?error=1", req.url), 303);
  }

  await createSession();
  return NextResponse.redirect(new URL("/admin", req.url), 303);
}
