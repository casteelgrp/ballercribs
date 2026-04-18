import { NextResponse } from "next/server";
import { createHeroPhoto, listAllHeroPhotos } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }
  const photos = await listAllHeroPhotos();
  return NextResponse.json({ photos });
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  let body: { url?: unknown; caption?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = String(body.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  const caption =
    typeof body.caption === "string" && body.caption.trim() ? body.caption.trim() : null;

  const photo = await createHeroPhoto(url, caption);
  return NextResponse.json({ ok: true, photo });
}
