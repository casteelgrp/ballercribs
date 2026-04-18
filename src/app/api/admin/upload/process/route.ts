import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MAX_WIDTH = 2000;
const ABSOLUTE_MAX_WIDTH = 4000; // upper bound regardless of caller request
const WEBP_QUALITY = 80;

function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  let body: { blob_url?: unknown; max_width?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const blobUrl = String(body.blob_url || "");
  if (!blobUrl || !isOurBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Invalid or missing blob_url" }, { status: 400 });
  }

  // Opt-in larger output for hero photos. Listings still use the default.
  // Clamped to ABSOLUTE_MAX_WIDTH so a caller can't ask for an 8000px panorama.
  const requestedMaxWidth = Number(body.max_width);
  const maxWidth =
    Number.isFinite(requestedMaxWidth) && requestedMaxWidth > 0
      ? Math.min(Math.round(requestedMaxWidth), ABSOLUTE_MAX_WIDTH)
      : DEFAULT_MAX_WIDTH;

  // Fetch the just-uploaded original from Blob.
  let res: Response;
  try {
    res = await fetch(blobUrl);
  } catch (err) {
    console.error("Fetch from Blob failed:", err);
    return NextResponse.json({ error: "Could not fetch uploaded image" }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Could not fetch uploaded image (${res.status})` },
      { status: 502 }
    );
  }
  const inputBuffer = Buffer.from(await res.arrayBuffer());

  // Process with sharp:
  //   - .rotate() applies EXIF orientation (portrait phone shots stay upright)
  //   - withoutEnlargement keeps small images at their native size
  //   - WebP @ 80 is the project standard
  let processedBuffer: Buffer;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const pipeline = sharp(inputBuffer)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    processedBuffer = data;
    width = info.width;
    height = info.height;
  } catch (err) {
    console.error("sharp processing failed:", err);
    return NextResponse.json({ error: "Image processing failed" }, { status: 422 });
  }

  // Build a clean filename from the original path.
  const pathname = new URL(blobUrl).pathname;
  const originalName = pathname.split("/").pop() || "image";
  const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
  const finalName = `${baseName}.webp`;

  let finalUrl: string;
  try {
    const result = await put(finalName, processedBuffer, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: true
    });
    finalUrl = result.url;
  } catch (err) {
    console.error("Blob put failed:", err);
    return NextResponse.json({ error: "Could not save processed image" }, { status: 500 });
  }

  // Best-effort cleanup of the original. Failure here is non-fatal.
  try {
    await del(blobUrl);
  } catch (err) {
    console.warn("Failed to delete original blob:", err);
  }

  return NextResponse.json({
    url: finalUrl,
    width: width ?? null,
    height: height ?? null,
    bytes: processedBuffer.length
  });
}
