"use client";

import type { Editor } from "@tiptap/core";
import { canMoveBlockNode, moveBlockNode } from "@/lib/editor-move";

/**
 * Up/Down chevrons that share the existing NodeView pill row across
 * BlogImage, Gallery, VideoEmbed, and PropertyCard. Same hover/disabled
 * treatment as the Edit + Remove pills they sit alongside.
 *
 * `getPos` is the live position-resolver supplied by NodeViewProps —
 * call it on click rather than during render so a sibling insert /
 * delete between renders doesn't dispatch a stale position.
 */
export function BlockMoveControls({
  editor,
  getPos
}: {
  editor: Editor;
  getPos: (() => number | undefined) | undefined;
}) {
  // Resolve once at render so the disabled state reflects current
  // siblings — render is triggered by editor transactions, so this
  // re-evaluates whenever the doc shape changes.
  const pos = typeof getPos === "function" ? getPos() : null;
  const movable = pos !== null && pos !== undefined;
  const canUp = movable ? canMoveBlockNode(editor, pos, "up") : false;
  const canDown = movable ? canMoveBlockNode(editor, pos, "down") : false;

  function dispatchMove(direction: "up" | "down") {
    if (typeof getPos !== "function") return;
    const livePos = getPos();
    if (livePos === undefined || livePos === null) return;
    moveBlockNode(editor, livePos, direction);
  }

  const btnClass =
    "text-[10px] uppercase tracking-widest bg-white border border-black/20 px-2 py-1 hover:border-black/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={() => dispatchMove("up")}
        disabled={!canUp}
        aria-label="Move up"
        className={btnClass}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M2 6.5L5 3.5L8 6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => dispatchMove("down")}
        disabled={!canDown}
        aria-label="Move down"
        className={btnClass}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
