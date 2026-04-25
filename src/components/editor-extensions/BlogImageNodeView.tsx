"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { BlogImageAttrs } from "./BlogImage";

/**
 * Editor-surface rendering for inline images. Mirrors the public output:
 * <figure><img><figcaption></figcaption></figure> when caption is set;
 * bare <img> otherwise. Adds Edit + Remove pills that match the
 * PropertyCard / Gallery / VideoEmbed NodeView treatment so authors
 * have one consistent pattern for every block element.
 */
export function BlogImageNodeView(props: NodeViewProps) {
  const attrs = props.node.attrs as BlogImageAttrs;
  const caption = attrs.caption?.trim() ?? "";

  function requestEdit() {
    const cb = props.editor.storage.image?.onEditRequest as
      | undefined
      | ((pos: number, attrs: BlogImageAttrs) => void);
    if (!cb) return;
    const pos = typeof props.getPos === "function" ? props.getPos() : null;
    if (pos === null || pos === undefined) return;
    cb(pos, {
      src: attrs.src,
      alt: attrs.alt ?? "",
      caption
    });
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
      // contentEditable=false on the wrapper keeps the cursor from
      // landing inside the figure and trying to type into the image —
      // the modal is the only edit affordance.
      className="my-6 group relative"
      contentEditable={false}
    >
      <figure className={caption ? "blog-figure" : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attrs.src}
          alt={attrs.alt ?? ""}
          className="block max-w-full h-auto"
        />
        {caption && (
          <figcaption className="text-sm italic text-black/60 mt-2">
            {caption}
          </figcaption>
        )}
      </figure>

      <div className="absolute top-2 right-2 flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
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
