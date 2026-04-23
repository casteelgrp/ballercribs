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
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset when the modal opens so a re-open shows the latest `initial`
  // instead of last session's typing.
  useEffect(() => {
    if (open) setAttrs(initial ?? EMPTY);
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
          <label className={labelClass}>Photo URL *</label>
          <input
            required
            type="url"
            value={attrs.photoUrl}
            onChange={(e) => setAttrs({ ...attrs, photoUrl: e.target.value })}
            className={inputClass}
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
