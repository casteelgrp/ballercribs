"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadAndProcess } from "@/lib/upload-client";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
};

type Pending = { id: string; name: string; status: "uploading" | "processing" | "error"; error?: string };

export function ImageUpload({ label, value, onChange }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setPending({ id, name: file.name, status: "uploading" });

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 60_000);
    try {
      // Stage transition for visibility — uploadAndProcess does both steps.
      const result = await uploadAndProcess(file, abort.signal);
      onChange(result.url);
      setPending(null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? abort.signal.aborted
            ? "Upload timed out after 60s"
            : err.message
          : "Upload failed";
      console.error("[ImageUpload] failed:", err);
      setPending({ id, name: file.name, status: "error", error: msg });
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    void uploadOne(files[0]);
  }

  function setFromUrl() {
    const url = urlInput.trim();
    if (!url) return;
    onChange(url);
    setUrlInput("");
  }

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          {label}
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
          <span className="font-medium">Drop an image</span> or click to browse
        </p>
        <p className="text-xs text-black/50 mt-1">
          JPEG, PNG, WebP, AVIF, HEIC · resized to 2000px wide WebP · max 100MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Pending indicator */}
      {pending && (
        <div
          className={
            "flex items-center justify-between gap-2 px-2 py-1 text-xs " +
            (pending.status === "error" ? "bg-red-50 text-red-700" : "bg-black/5 text-black/70")
          }
        >
          <span className="truncate">
            {pending.name}
            {pending.status === "uploading" && " · uploading…"}
            {pending.status === "processing" && " · processing…"}
            {pending.status === "error" && ` · ${pending.error}`}
          </span>
          {pending.status === "error" && (
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-red-700 hover:text-red-900 font-bold"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Current image */}
      {value && (
        <div className="relative aspect-[4/3] border border-black/10 bg-black/5 overflow-hidden max-w-md">
          <Image
            src={value}
            alt=""
            fill
            sizes="400px"
            className="object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove image"
            className="absolute top-1 right-1 bg-black/70 text-white text-xs leading-none px-1.5 py-1 hover:bg-red-600"
          >
            ×
          </button>
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
                  setFromUrl();
                }
              }}
            />
            <button
              type="button"
              onClick={setFromUrl}
              className="px-4 py-2 text-xs uppercase tracking-widest border border-black/20 hover:border-accent hover:text-accent"
            >
              Set
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
