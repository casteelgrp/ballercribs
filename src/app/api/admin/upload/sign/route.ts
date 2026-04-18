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

  console.log("[BLOB_UPLOAD_DEBUG] incoming body type:", body?.type);
  console.log("[BLOB_UPLOAD_DEBUG] BLOB_READ_WRITE_TOKEN set:", Boolean(process.env.BLOB_READ_WRITE_TOKEN));
  console.log("[BLOB_UPLOAD_DEBUG] VERCEL_ENV:", process.env.VERCEL_ENV);

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        await requireUser();
        const opts = {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true
        };
        console.log("[BLOB_UPLOAD_DEBUG] generating token", {
          pathname,
          clientPayload,
          multipart,
          tokenOptions: opts
        });
        return opts;
      }
    });
    console.log("[BLOB_UPLOAD_DEBUG] handleUpload returned", {
      type: (jsonResponse as { type: string }).type,
      // Don't log the full token. Just length so we can confirm it generated.
      tokenLength:
        "clientToken" in jsonResponse ? (jsonResponse.clientToken as string).length : null
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    if (err instanceof Response) return err;
    // Capture EVERYTHING from the error so we can see whatever Vercel Blob is upset about.
    const e = err as Error & Record<string, unknown>;
    console.error("[BLOB_UPLOAD_ERROR] handleUpload threw", {
      message: e?.message,
      name: e?.name,
      stack: e?.stack,
      // Vercel Blob's BlobError subclasses often hang extra fields off the error object.
      cause: e?.cause,
      code: e?.code,
      status: e?.status,
      response: e?.response,
      body: e?.body,
      // Spread anything else attached to the error.
      raw: JSON.parse(
        JSON.stringify(e, Object.getOwnPropertyNames(e))
      )
    });
    return NextResponse.json(
      { error: e?.message || "Token generation failed" },
      { status: 400 }
    );
  }
}
