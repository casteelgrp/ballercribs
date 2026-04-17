import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
