"use client";

import { upload } from "@vercel/blob/client";

export interface ProcessedUpload {
  url: string;
  width: number | null;
  height: number | null;
  bytes?: number | null;
}

export interface UploadOptions {
  /** Override sharp's resize max width on the server. Default 2000; capped server-side at 4000. */
  maxWidth?: number;
}

/** Upload a file directly to Blob, then trigger sharp processing. Returns the processed image URL. */
export async function uploadAndProcess(
  file: File,
  signal?: AbortSignal,
  options: UploadOptions = {}
): Promise<ProcessedUpload> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/admin/upload/sign",
    abortSignal: signal
  });
  const procRes = await fetch("/api/admin/upload/process", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      blob_url: blob.url,
      ...(options.maxWidth !== undefined ? { max_width: options.maxWidth } : {})
    }),
    signal
  });
  if (!procRes.ok) {
    const data = await procRes.json().catch(() => ({}));
    throw new Error(data?.error || `Processing failed (${procRes.status})`);
  }
  return (await procRes.json()) as ProcessedUpload;
}
