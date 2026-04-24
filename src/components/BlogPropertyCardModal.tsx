"use client";

import { useEffect, useRef, useState } from "react";
import type { PropertyCardAttrs } from "./editor-extensions/PropertyCard";

const DEFAULT_CTA = "View property →";

const EMPTY: PropertyCardAttrs = {
  name: "",
  location: "",
  photoUrl: "",
  blurb: "",
  url: "",
  ctaLabel: DEFAULT_CTA
};

/**
 * Modal for inserting or editing a property card. Controlled by
 * <BlogEditor>: when `open` is true the modal is visible, `initial`
 * pre-fills the fields, and `onSave` emits the final attrs back up.
 *
 * No drag/drop, no image upload — the photoUrl field accepts a URL
 * directly. If we want inline upload later, it's one more field.
 */
export function BlogPropertyCardModal({
  open,
  initial,
  onSave,
  onClose
}: {
  open: boolean;
  initial: PropertyCardAttrs | null;
  onSave: (attrs: PropertyCardAttrs) => void;
  onClose: () => void;
}) {
  const [attrs, setAttrs] = useState<PropertyCardAttrs>(initial ?? EMPTY);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  // The preview's <img> falls back to a neutral block when the URL 404s
  // or otherwise fails to load — keyed off the URL itself so a new
  // photoUrl retries cleanly.
  const [previewFailedFor, setPreviewFailedFor] = useState<string>("");
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when the modal opens so a re-open shows the latest `initial`
  // instead of last session's typing.
  useEffect(() => {
    if (open) {
      setAttrs(initial ?? EMPTY);
      setUploadError("");
      setPreviewFailedFor("");
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Not a <form onSubmit> — this modal renders inside BlogForm's form, and
  // nested forms are invalid HTML (triggers a hydration warning and can
  // swallow the outer submit). Insert is wired to a button click instead;
  // the keydown handler keeps "Enter to submit" behaviour in text inputs
  // so removing the form doesn't cost us keyboard UX.
  function commit() {
    if (!attrs.name.trim() || !attrs.photoUrl.trim() || !attrs.url.trim()) return;
    const finalAttrs: PropertyCardAttrs = {
      ...attrs,
      ctaLabel: attrs.ctaLabel.trim() || DEFAULT_CTA
    };
    onSave(finalAttrs);
  }

  function onFieldKeyDown(e: React.KeyboardEvent) {
    // Let Enter make newlines inside the textarea — only submit when the
    // focus is on a single-line input. Ignore modifier combos so
    // Cmd+Enter / Shift+Enter stay available for future power-user wiring.
    const tag = (e.target as HTMLElement).tagName;
    if (e.key !== "Enter" || tag === "TEXTAREA" || e.shiftKey || e.metaKey || e.ctrlKey) {
      return;
    }
    e.preventDefault();
    commit();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: fd
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setUploadError(data.error || "Upload failed. Try again or paste a URL.");
        return;
      }
      // Uploading the same URL twice shouldn't leave the preview stuck
      // in the failed state — reset the error key so onError can fire
      // fresh if the new URL also fails.
      setPreviewFailedFor("");
      setAttrs((a) => ({ ...a, photoUrl: data.url as string }));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Try again or paste a URL."
      );
    } finally {
      setUploading(false);
    }
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit property card" : "Insert property card"}
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onKeyDown={onFieldKeyDown}
        className="bg-white max-w-lg w-full border border-black/10 p-6 space-y-4"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">
            {initial ? "Edit property card" : "Insert property card"}
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
          <label className={labelClass}>Property name *</label>
          <input
            ref={firstFieldRef}
            required
            value={attrs.name}
            onChange={(e) => setAttrs({ ...attrs, name: e.target.value })}
            className={inputClass}
            placeholder="Villa Mandalay"
          />
        </div>

        <div>
          <label className={labelClass}>Location</label>
          <input
            value={attrs.location}
            onChange={(e) => setAttrs({ ...attrs, location: e.target.value })}
            className={inputClass}
            placeholder="Mykonos, Greece"
          />
        </div>

        <div>
          <span className={labelClass}>Photo *</span>
          {/* Preview thumbnail. Keyed off attrs.photoUrl so it shows for
              any source: newly-uploaded, pasted URL, or pre-filled on
              edit. onError falls back to a neutral "preview unavailable"
              block (same pattern as FeatureTile) without clearing
              photoUrl — the saved node may still render if the URL was
              briefly unreachable. */}
          {attrs.photoUrl && (
            <div className="mb-2 relative aspect-square w-32 overflow-hidden border border-black/10 bg-black/5">
              {previewFailedFor === attrs.photoUrl ? (
                <div className="absolute inset-0 flex items-center justify-center text-center text-[10px] uppercase tracking-widest text-black/40 p-2">
                  Preview unavailable
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attrs.photoUrl}
                  alt="Property photo preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={() => setPreviewFailedFor(attrs.photoUrl)}
                />
              )}
            </div>
          )}

          {/* Upload button triggers the hidden file picker. Disabled
              while a request is in flight. On success, photoUrl is set
              from the endpoint's returned URL (same shape as the paste
              path). On failure, the error renders inline and the URL
              input remains available as a fallback. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : "Upload image"}
            </button>
            <span className="text-[10px] uppercase tracking-widest text-black/40">
              or paste URL
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              // Reset so selecting the same file twice still fires onChange.
              e.target.value = "";
            }}
          />
          {uploadError && (
            <p className="mt-1 text-xs text-red-600">{uploadError}</p>
          )}

          <input
            type="url"
            value={attrs.photoUrl}
            onChange={(e) => {
              setPreviewFailedFor("");
              setAttrs({ ...attrs, photoUrl: e.target.value });
            }}
            className={inputClass + " mt-2"}
            placeholder="https://…/hero.webp"
          />
        </div>

        <div>
          <label className={labelClass}>Blurb (1-2 sentences)</label>
          <textarea
            rows={3}
            value={attrs.blurb}
            onChange={(e) => setAttrs({ ...attrs, blurb: e.target.value })}
            className={inputClass}
            placeholder="Eight-bedroom villa on the cliffs of Agios Lazaros, private infinity pool cantilevered over the Aegean."
          />
        </div>

        <div>
          <label className={labelClass}>Outbound URL *</label>
          <input
            required
            type="url"
            value={attrs.url}
            onChange={(e) => setAttrs({ ...attrs, url: e.target.value })}
            className={inputClass}
            placeholder="https://partner.example.com/property/123"
          />
          <p className="text-xs text-black/50 mt-1">
            Link opens in a new tab with rel=&quot;noopener noreferrer&quot;.
          </p>
        </div>

        <div>
          <label className={labelClass}>CTA label</label>
          <input
            value={attrs.ctaLabel}
            onChange={(e) => setAttrs({ ...attrs, ctaLabel: e.target.value })}
            className={inputClass}
            placeholder={DEFAULT_CTA}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={commit}
            className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
          >
            {initial ? "Save changes" : "Insert card"}
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
