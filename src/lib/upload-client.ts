"use client";

import { upload } from "@vercel/blob/client";

export interface ProcessedUpload {
  url: string;
  width: number | null;
  height: number | null;
  bytes?: number | null;
}

/** Upload a file directly to Blob, then trigger sharp processing. Returns the processed image URL. */
export async function uploadAndProcess(
  file: File,
  signal?: AbortSignal
): Promise<ProcessedUpload> {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/admin/upload/sign",
    abortSignal: signal
  });
  const procRes = await fetch("/api/admin/upload/process", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blob_url: blob.url }),
    signal
  });
  if (!procRes.ok) {
    const data = await procRes.json().catch(() => ({}));
    throw new Error(data?.error || `Processing failed (${procRes.status})`);
  }
  return (await procRes.json()) as ProcessedUpload;
}
