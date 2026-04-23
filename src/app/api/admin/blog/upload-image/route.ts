import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Tuning matches /api/admin/upload/process so in-editor images and cover
// uploads have identical output characteristics — 2000px long edge, webp
// at 80% quality, EXIF-rotated. The 100MB cap matches the main upload
// endpoint; TipTap's default client-side limit is smaller anyway, but we
// don't want a 400MB phone panorama to silently blow past us.
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif"
]);
const MAX_WIDTH = 2000;
const WEBP_QUALITY = 80;
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * POST /api/admin/blog/upload-image
 *
 * Single-step FormData upload for TipTap's inline image extension. The
 * client sends a `file` field; we process with sharp, store in Blob, and
 * return `{ url }`. Matches TipTap's expected response shape so the
 * Image extension can insert the node without additional wiring.
 */
export async function POST(req: Request) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${mime}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` },
      { status: 400 }
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  try {
    processed = await sharp(inputBuffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (err) {
    console.error("[blog-image] sharp failed:", err);
    return NextResponse.json({ error: "Image processing failed" }, { status: 422 });
  }

  // Derive a clean filename. TipTap sends File objects with a `name` but
  // Blob from FormData.get() might not — fall back to a generic stem.
  const originalName = (file as File).name || "blog-image";
  const baseName = originalName.replace(/\.[^.]+$/, "") || "blog-image";
  const finalName = `blog/${baseName}.webp`;

  try {
    const result = await put(finalName, processed, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: true
    });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[blog-image] blob put failed:", err);
    return NextResponse.json({ error: "Could not save image" }, { status: 500 });
  }
}
