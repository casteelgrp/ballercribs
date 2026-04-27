"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GalleryLightbox, type LightboxItem } from "./GalleryLightbox";

type LightboxState = { items: LightboxItem[]; index: number };

/**
 * Client-side wrapper around body_html. The HTML itself still renders
 * server-side via dangerouslySetInnerHTML — no SSR regression. On mount,
 * a useEffect pass delegates clicks on any `[data-gallery] figure` to a
 * lightbox, reading the image src + caption text directly from the
 * rendered markup (not from the data-images JSON blob, which is an
 * implementation detail for the TipTap round-trip).
 *
 * Why delegation: the gallery markup is ordinary <div>/<figure>/<img>,
 * not React components. Attaching one container-level listener avoids
 * re-wiring every time the body updates.
 */
export function BlogBody({ html }: { html: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const figure = target.closest<HTMLElement>("[data-gallery] figure");
      if (!figure) return;
      // Walk up to the gallery container to collect sibling items in
      // their rendered order.
      const container = figure.closest<HTMLElement>("[data-gallery]");
      if (!container) return;

      const figures = Array.from(
        container.querySelectorAll<HTMLElement>("figure")
      );
      const items: LightboxItem[] = figures.map((f) => {
        const img = f.querySelector<HTMLImageElement>("img");
        const caption = f.querySelector<HTMLElement>("figcaption");
        return {
          src: img?.src ?? "",
          caption: caption?.textContent ?? ""
        };
      });
      const index = figures.indexOf(figure);
      if (index < 0 || items.length === 0) return;

      // Tap that lands on the figure but the src is empty (shouldn't
      // happen post-sanitize but defensive) just closes any open
      // lightbox rather than opening a broken one.
      if (!items[index].src) {
        setLightbox(null);
        return;
      }
      e.preventDefault();
      setLightbox({ items, index });
    }

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
    // Re-bind when the HTML body changes (e.g. during dev HMR or
    // parent-driven navigation).
  }, [html]);

  // Wrap each <table class="blog-table"> in <div class="blog-table-wrap">
  // so the wrapper handles horizontal scroll on narrow viewports without
  // forcing display:block on the <table> itself (which would break its
  // tabular layout). Memoized on `html` so opening / closing the
  // gallery lightbox doesn't re-run the regex on each setState.
  // The transform is presentation-only and runs after sanitization,
  // so the security boundary stays at sanitize time.
  const renderedHtml = useMemo(() => wrapTablesForScroll(html), [html]);

  return (
    <>
      <div
        ref={bodyRef}
        className="blog-prose"
        // body_html is sanitized server-side by sanitizeBlogHtml at
        // write time (see /api/admin/blog/posts POST + PATCH).
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
      {lightbox && (
        <GalleryLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(nextIndex) =>
            setLightbox((curr) => (curr ? { ...curr, index: nextIndex } : curr))
          }
        />
      )}
    </>
  );
}

/**
 * Wrap each `<table class="blog-table">` in a scrolling div. Lives
 * outside sanitization (which is purely a security gate) — this is a
 * presentation-layer transform.
 *
 * Regex matches the literal class="blog-table" attribute that the
 * editor's Table.configure stamps on every table. Other class shapes
 * (e.g. an author hand-pastes a <table> with extra classes) won't
 * pick up the wrapper — acceptable because the sanitizer's class
 * passthrough preserves whatever was authored, and the wrapper is
 * specifically scoped to editor-emitted tables.
 */
function wrapTablesForScroll(html: string): string {
  return html.replace(
    /(<table\b[^>]*\bclass="[^"]*\bblog-table\b[^"]*"[^>]*>[\s\S]*?<\/table>)/g,
    '<div class="blog-table-wrap">$1</div>'
  );
}
