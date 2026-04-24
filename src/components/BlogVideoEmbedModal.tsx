"use client";

import { useEffect, useState } from "react";
import { parseVideoUrl, type ParsedVideo } from "@/lib/video-url";
import type { VideoEmbedAttrs } from "./editor-extensions/VideoEmbed";

/**
 * Slim modal for inserting / editing a video embed. Single URL field
 * with live provider detection — as the author types/pastes, we parse
 * on every change and show one of three states:
 *   - Empty / idle
 *   - Detected: YouTube video (+ optional "starts at …")
 *   - Detected: Vimeo video
 *   - Unrecognized URL — insert disabled
 *
 * Not a <form onSubmit> — modal renders inside BlogForm's form; nested
 * forms are invalid HTML. Insert wires to a button click; Enter in
 * the URL field triggers commit if a valid parse is ready.
 */
export function BlogVideoEmbedModal({
  open,
  initial,
  onSave,
  onClose
}: {
  open: boolean;
  initial: VideoEmbedAttrs | null;
  onSave: (attrs: VideoEmbedAttrs) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedVideo | null>(null);
  const [touched, setTouched] = useState(false);

  // Reset when the modal opens so edit-reopens show the original URL.
  useEffect(() => {
    if (!open) return;
    const startUrl = initial?.url ?? "";
    setUrl(startUrl);
    setParsed(startUrl ? parseVideoUrl(startUrl) : null);
    setTouched(false);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function onUrlChange(next: string) {
    setUrl(next);
    setTouched(true);
    setParsed(next.trim() ? parseVideoUrl(next) : null);
  }

  function commit() {
    if (!parsed) return;
    onSave({
      provider: parsed.provider,
      videoId: parsed.videoId,
      url: parsed.originalUrl,
      startAt: parsed.startAt,
      vimeoHash: parsed.vimeoHash
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (parsed) commit();
    }
  }

  // Detection state drives the label below the input.
  let detection: {
    kind: "idle" | "ok" | "error";
    text: string;
  };
  if (!url.trim()) {
    detection = { kind: "idle", text: "Paste a YouTube or Vimeo URL to detect." };
  } else if (parsed) {
    const name = parsed.provider === "youtube" ? "YouTube" : "Vimeo";
    const extra =
      parsed.provider === "youtube" && parsed.startAt
        ? ` (starts at ${formatStart(parsed.startAt)})`
        : parsed.vimeoHash
          ? " (unlisted)"
          : "";
    detection = { kind: "ok", text: `Detected: ${name} video${extra}` };
  } else {
    detection = {
      kind: "error",
      text: "Unrecognized URL — only YouTube and Vimeo are supported."
    };
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit video" : "Insert video"}
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white max-w-lg w-full border border-black/10 p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">
            {initial ? "Edit video" : "Insert video"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 hover:text-black text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div>
          <label className={labelClass} htmlFor="video-url">
            Video URL *
          </label>
          <input
            id="video-url"
            autoFocus
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={onKeyDown}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=…  or  https://vimeo.com/…"
          />
          <p
            className={
              "mt-2 text-xs " +
              (detection.kind === "ok"
                ? "text-accent"
                : detection.kind === "error" && touched
                  ? "text-red-600"
                  : "text-black/50")
            }
          >
            {detection.text}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={commit}
            disabled={!parsed}
            className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {initial ? "Save changes" : "Insert video"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-black/20 px-5 py-2 text-sm uppercase tracking-widest hover:border-black/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function formatStart(seconds: number): string {
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
