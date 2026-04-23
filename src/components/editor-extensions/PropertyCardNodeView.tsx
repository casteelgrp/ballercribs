"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { PropertyCardAttrs } from "./PropertyCard";

/**
 * Editor-surface rendering of a property card. Shows the same content
 * readers see (photo + name + blurb + CTA) plus an "Edit" pill that
 * delegates to the BlogEditor's modal via the extension's storage.
 *
 * Non-interactive in the editor — we don't let clicks traverse into the
 * outbound link, since that would be a footgun for the author.
 */
export function PropertyCardNodeView(props: NodeViewProps) {
  const attrs = props.node.attrs as PropertyCardAttrs;

  function requestEdit() {
    const cb = props.editor.storage.propertyCard?.onEditRequest as
      | undefined
      | ((pos: number, attrs: PropertyCardAttrs) => void);
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
      data-property-card="true"
      className="my-6 border border-black/10 bg-black/[0.02] group relative"
    >
      {/* Photo left, body right on md+; stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0 items-stretch">
        <div className="relative aspect-square md:aspect-auto bg-black/5 overflow-hidden">
          {attrs.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attrs.photoUrl}
              alt={attrs.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-black/40">
              No photo
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col">
          <p className="text-[10px] uppercase tracking-widest text-accent">Property</p>
          <h3 className="font-display text-xl leading-tight mt-1">
            {attrs.name || "Untitled property"}
          </h3>
          <p className="text-sm text-black/60 mt-0.5">{attrs.location}</p>
          {attrs.blurb && (
            <p className="text-sm text-black/70 mt-2 leading-relaxed">{attrs.blurb}</p>
          )}
          <div className="mt-auto pt-3">
            <span className="inline-block bg-accent text-ink text-xs uppercase tracking-widest px-3 py-1.5">
              {attrs.ctaLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Edit / remove controls. Always visible so selection state isn't
          required; hover brightens them so they don't scream at rest. */}
      <div
        className="absolute top-2 right-2 flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
        contentEditable={false}
      >
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
