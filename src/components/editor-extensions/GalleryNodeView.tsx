"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { GalleryAttrs, GalleryItem } from "./Gallery";
import { BlockMoveControls } from "./BlockMoveControls";

/**
 * Compact in-editor preview of a gallery — up to 4 thumbnails + a
 * "+N more" badge when there are more, plus the count and the
 * standard Edit / Remove pair (same pattern as PropertyCard). Full
 * grid + lightbox only render on the public page.
 */
export function GalleryNodeView(props: NodeViewProps) {
  const attrs = props.node.attrs as GalleryAttrs;
  const images = attrs.images ?? [];
  const MAX_THUMBS = 4;
  const visible = images.slice(0, MAX_THUMBS);
  const overflow = Math.max(0, images.length - MAX_THUMBS);

  function requestEdit() {
    const cb = props.editor.storage.gallery?.onEditRequest as
      | undefined
      | ((pos: number, attrs: GalleryAttrs) => void);
    if (!cb) return;
    const pos = typeof props.getPos === "function" ? props.getPos() : null;
    if (pos === null || pos === undefined) return;
    cb(pos, attrs);
  }

  function remove() {
    if (typeof props.getPos !== "function") return;
    const pos = props.getPos();
    if (pos === null || pos === undefined) return;
    const { view } = props.editor;
    const tr = view.state.tr.delete(pos, pos + props.node.nodeSize);
    view.dispatch(tr);
  }

  return (
    <NodeViewWrapper
      data-gallery-editor-preview="true"
      className="my-6 border border-black/10 bg-black/[0.02] group relative p-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-accent">
          Gallery
        </span>
        <span className="text-xs text-black/60">
          {images.length} image{images.length === 1 ? "" : "s"}
        </span>
      </div>

      {images.length === 0 ? (
        <p className="text-xs text-black/50 italic">
          Empty gallery — click Edit to add images.
        </p>
      ) : (
        <div className="flex gap-2 items-stretch">
          {visible.map((img: GalleryItem, i) => (
            <div
              key={`${img.url}-${i}`}
              className="relative w-20 h-20 bg-black/5 border border-black/10 overflow-hidden flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption || ""}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          ))}
          {overflow > 0 && (
            <div className="w-20 h-20 border border-black/10 bg-black/[0.04] flex items-center justify-center text-xs text-black/60 flex-shrink-0">
              +{overflow}
            </div>
          )}
        </div>
      )}

      <div
        className="absolute top-2 right-2 flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
        contentEditable={false}
      >
        <BlockMoveControls editor={props.editor} getPos={props.getPos} />
        <button
          type="button"
          onClick={requestEdit}
          className="text-[10px] uppercase tracking-widest bg-ink text-paper px-2 py-1 hover:bg-accent hover:text-ink transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          className="text-[10px] uppercase tracking-widest bg-white border border-black/20 px-2 py-1 hover:border-red-500 hover:text-red-600 transition-colors"
        >
          Remove
        </button>
      </div>
    </NodeViewWrapper>
  );
}
