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
      // Auth happens here so the post-upload webhook (different request type)
      // isn't blocked. We omit onUploadCompleted on purpose — sharp processing
      // is done in the explicit /process route the client calls after upload.
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
    const e = err as Error & Record<string, unknown>;
    // Log enough to debug future issues without spamming on success.
    // The full property spread caught the "private store" misconfig that
    // wasn't in the standard Error fields — keep that pattern.
    console.error("[BLOB_UPLOAD_ERROR]", {
      message: e?.message,
      name: e?.name,
      code: e?.code,
      status: e?.status,
      raw: JSON.parse(JSON.stringify(e, Object.getOwnPropertyNames(e)))
    });
    return NextResponse.json(
      { error: e?.message || "Token generation failed" },
      { status: 400 }
    );
  }
}
