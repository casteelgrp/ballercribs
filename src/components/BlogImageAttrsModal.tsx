"use client";

import { useEffect, useRef, useState } from "react";
import type { BlogImageAttrs } from "./editor-extensions/BlogImage";

/**
 * Modal for editing inline-image alt text + caption. Same shell as the
 * property-card / gallery / video modals — controlled by <BlogEditor>,
 * pre-fills from `initial`, emits final attrs via `onSave`.
 *
 * Image insertion itself happens via the toolbar Upload flow, which
 * lands the <img> with empty alt and caption; the author opens this
 * modal afterwards to fill them in. Keeps the upload path one-shot
 * and the editing path explicit.
 */
export function BlogImageAttrsModal({
  open,
  initial,
  onSave,
  onClose
}: {
  open: boolean;
  initial: BlogImageAttrs | null;
  onSave: (attrs: BlogImageAttrs) => void;
  onClose: () => void;
}) {
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAlt(initial?.alt ?? "");
      setCaption(initial?.caption ?? "");
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

  if (!open || !initial) return null;

  function commit() {
    if (!initial) return;
    onSave({
      src: initial.src,
      alt: alt.trim(),
      caption: caption.trim()
    });
  }

  function onFieldKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key !== "Enter" || tag === "TEXTAREA" || e.shiftKey || e.metaKey || e.ctrlKey) {
      return;
    }
    e.preventDefault();
    commit();
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit image"
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
          <h2 className="font-display text-xl">Edit image</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 hover:text-black text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Preview so the author isn't editing alt text blindly. Sits at
            the top so the inputs below feel attached to the thing
            they're describing. */}
        <div className="bg-black/5 border border-black/10 aspect-video w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={initial.src}
            alt=""
            className="w-full h-full object-contain"
          />
        </div>

        <div>
          <label className={labelClass}>Alt text</label>
          <input
            ref={firstFieldRef}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            className={inputClass}
            placeholder="Describe what's in the image for screen readers."
          />
          <p className="text-xs text-black/50 mt-1">
            Describes the image to screen readers + crawlers. Leave empty for
            decorative images.
          </p>
        </div>

        <div>
          <label className={labelClass}>Caption (optional)</label>
          <textarea
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={inputClass}
            placeholder="Editorial caption shown below the image."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={commit}
            className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
          >
            Save
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
