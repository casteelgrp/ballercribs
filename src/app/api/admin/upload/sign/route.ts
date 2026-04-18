import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif"
];

const MAX_BYTES = 100 * 1024 * 1024; // 100MB cap on raw upload

export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // Auth check happens here. We deliberately omit onUploadCompleted
      // because we do the sharp processing in a separate /process route
      // the client calls explicitly — a webhook callback would force Blob
      // to wait on a no-op handler and adds a hang surface for nothing.
      onBeforeGenerateToken: async () => {
        await requireUser();
        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true
        };
      }
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("upload/sign failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token generation failed" },
      { status: 400 }
    );
  }
}
