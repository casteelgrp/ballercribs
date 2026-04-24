"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type LightboxItem = { src: string; caption: string };

/**
 * Full-screen lightbox for blog gallery images. Vanilla JS only — no
 * library. Keyboard nav (←/→, Esc), mobile touch swipe (left/right
 * gestures change slide), click-outside-image to close.
 *
 * Rendered via portal on <body> so it isn't clipped by .blog-prose
 * max-width or any parent overflow:hidden.
 */
export function GalleryLightbox({
  items,
  index,
  onClose,
  onNavigate
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") {
        onNavigate(Math.max(0, index - 1));
      } else if (e.key === "ArrowRight") {
        onNavigate(Math.min(items.length - 1, index + 1));
      }
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while open — matches BlogPropertyCardModal's
    // approach for consistency.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, items.length, onClose, onNavigate]);

  if (!mounted) return null;

  const current = items[index];
  if (!current) return null;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    const THRESHOLD = 50;
    if (delta > THRESHOLD && hasPrev) onNavigate(index - 1);
    else if (delta < -THRESHOLD && hasNext) onNavigate(index + 1);
  }

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 sm:p-8"
      onClick={(e) => {
        // Close when the backdrop (not the image) is clicked.
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
      >
        ×
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          type="button"
          onClick={() => onNavigate(index - 1)}
          aria-label="Previous image"
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/80 hover:text-white text-4xl"
        >
          ‹
        </button>
      )}

      {/* Image + optional caption */}
      <figure className="max-w-full max-h-full flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.caption}
          className="max-w-full max-h-[85vh] object-contain"
        />
        {current.caption && (
          <figcaption className="text-sm text-white/75 max-w-xl text-center px-4">
            {current.caption}
          </figcaption>
        )}
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          {index + 1} / {items.length}
        </p>
      </figure>

      {/* Next */}
      {hasNext && (
        <button
          type="button"
          onClick={() => onNavigate(index + 1)}
          aria-label="Next image"
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/80 hover:text-white text-4xl"
        >
          ›
        </button>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
