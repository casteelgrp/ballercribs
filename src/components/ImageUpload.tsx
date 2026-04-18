"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";

type SingleProps = {
  mode: "single";
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

type MultiProps = {
  mode: "multi";
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
};

type Props = SingleProps | MultiProps;

type PendingFile = { id: string; name: string; status: "uploading" | "processing" | "error"; error?: string };

export function ImageUpload(props: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSingle = props.mode === "single";
  const urls: string[] = isSingle
    ? props.value
      ? [props.value]
      : []
    : props.value;

  function emitChange(next: string[]) {
    if (isSingle) {
      (props as SingleProps).onChange(next[0] ?? "");
    } else {
      (props as MultiProps).onChange(next);
    }
  }

  function appendUrl(url: string) {
    if (!url) return;
    if (isSingle) {
      emitChange([url]);
    } else {
      emitChange([...urls, url]);
    }
  }

  function removeUrl(target: string) {
    emitChange(urls.filter((u) => u !== target));
  }

  async function uploadOne(file: File) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setPending((p) => [...p, { id, name: file.name, status: "uploading" }]);

    // 60s safety timeout — if upload never resolves we want a clear error,
    // not an indefinitely stuck "uploading…".
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 60_000);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload/sign",
        abortSignal: abort.signal
      });
      setPending((p) =>
        p.map((x) => (x.id === id ? { ...x, status: "processing" } : x))
      );
      const procRes = await fetch("/api/admin/upload/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blob_url: blob.url })
      });
      if (!procRes.ok) {
        const data = await procRes.json().catch(() => ({}));
        throw new Error(data?.error || `Processing failed (${procRes.status})`);
      }
      const { url } = await procRes.json();
      appendUrl(url);
      setPending((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === "AbortError" || abort.signal.aborted
            ? "Upload timed out after 60s — check browser console + network tab"
            : err.message
          : "Upload failed";
      console.error("[ImageUpload] upload failed:", err);
      setPending((p) =>
        p.map((x) => (x.id === id ? { ...x, status: "error", error: msg } : x))
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    if (isSingle) {
      // Single mode: only the first file matters.
      await uploadOne(arr[0]);
    } else {
      // Multi: serial uploads to avoid bursting Vercel Blob.
      for (const file of arr) {
        await uploadOne(file);
      }
    }
  }

  function dismissError(id: string) {
    setPending((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-3">
      {props.label && (
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          {props.label}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={
          "border-2 border-dashed cursor-pointer text-center px-4 py-8 transition-colors " +
          (dragOver
            ? "border-accent bg-accent/5"
            : "border-black/20 bg-black/[0.02] hover:border-black/40")
        }
      >
        <p className="text-sm">
          <span className="font-medium">Drop {isSingle ? "an image" : "images"}</span> or
          click to browse
        </p>
        <p className="text-xs text-black/50 mt-1">
          JPEG, PNG, WebP, AVIF, HEIC · resized to 2000px wide WebP · max 100MB each
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple={!isSingle}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
      </div>

      {/* Pending files */}
      {pending.length > 0 && (
        <ul className="text-xs space-y-1">
          {pending.map((p) => (
            <li
              key={p.id}
              className={
                "flex items-center justify-between gap-2 px-2 py-1 " +
                (p.status === "error" ? "bg-red-50 text-red-700" : "bg-black/5 text-black/70")
              }
            >
              <span className="truncate">
                {p.name}
                {p.status === "uploading" && " · uploading…"}
                {p.status === "processing" && " · processing…"}
                {p.status === "error" && ` · ${p.error}`}
              </span>
              {p.status === "error" && (
                <button
                  type="button"
                  onClick={() => dismissError(p.id)}
                  className="text-red-700 hover:text-red-900 font-bold"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Existing thumbnails */}
      {urls.length > 0 && (
        <div
          className={
            isSingle
              ? "grid grid-cols-1"
              : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2"
          }
        >
          {urls.map((url) => (
            <div
              key={url}
              className="relative group border border-black/10 bg-black/5 aspect-[4/3] overflow-hidden"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 33vw, 200px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => removeUrl(url)}
                aria-label="Remove image"
                className="absolute top-1 right-1 bg-black/70 text-white text-xs leading-none px-1.5 py-1 hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* URL paste fallback */}
      <div>
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className="text-xs uppercase tracking-widest text-black/50 hover:text-accent underline-offset-4 hover:underline"
        >
          {showUrl ? "Hide URL paste" : "Or paste a URL (MLS link, etc.)"}
        </button>
        {showUrl && (
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  appendUrl(urlInput.trim());
                  setUrlInput("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                appendUrl(urlInput.trim());
                setUrlInput("");
              }}
              className="px-4 py-2 text-xs uppercase tracking-widest border border-black/20 hover:border-accent hover:text-accent"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
