import type { Editor } from "@tiptap/core";

/**
 * Swap a top-level block node with its previous or next sibling.
 *
 * Shared by the four block-node NodeViews (BlogImage, VideoEmbed,
 * Gallery, PropertyCard) so the Move Up / Move Down arrows on each
 * pill row dispatch the same transaction shape — no copy-pasted move
 * logic across NodeViews.
 *
 * Position semantics: `pos` is the start position of the node to move
 * (what NodeView's getPos() returns). The function locates the node,
 * confirms it sits at the document's top level, finds the immediate
 * sibling in the requested direction, and dispatches a single delete
 * + insert as one transaction so undo/redo treats it atomically.
 *
 * Returns true if the swap dispatched, false if the move was a no-op
 * (already at the edge, or pos doesn't resolve to a moveable node).
 * Callers use the return value only for telemetry — the buttons that
 * call this are pre-disabled at the edges, so the no-op path is rare.
 */
export type MoveDirection = "up" | "down";

export function moveBlockNode(
  editor: Editor,
  pos: number,
  direction: MoveDirection
): boolean {
  const { state, view } = editor;
  const $pos = state.doc.resolve(pos);

  // Top-level block? Depth 0 is the document root; depth 1 is a direct
  // child of the doc. We only support moves at depth 1 — nested nodes
  // (e.g., a hypothetical image inside a list item) aren't in scope.
  if ($pos.depth !== 0) return false;

  const node = state.doc.nodeAt(pos);
  if (!node) return false;

  const index = $pos.index(0);
  const parent = $pos.node(0);

  if (direction === "up") {
    if (index === 0) return false;
    const prev = parent.child(index - 1);
    const prevPos = pos - prev.nodeSize;
    // Delete then insert. ProseMirror handles position mapping for us
    // when the deletion happens before the insertion target.
    const tr = state.tr
      .delete(pos, pos + node.nodeSize)
      .insert(prevPos, node);
    view.dispatch(tr);
    return true;
  }

  // direction === "down"
  if (index >= parent.childCount - 1) return false;
  const next = parent.child(index + 1);
  const afterNext = pos + node.nodeSize + next.nodeSize;
  // Insert at afterNext FIRST so the original position doesn't shift
  // before the delete sees it. ProseMirror's mapping handles the rest.
  const tr = state.tr
    .insert(afterNext, node)
    .delete(pos, pos + node.nodeSize);
  view.dispatch(tr);
  return true;
}

/**
 * Whether `pos` can move in the given direction at the document's
 * top level. Used to disable the chevron buttons on the edge blocks
 * so the click is visually muted instead of dispatching a no-op.
 */
export function canMoveBlockNode(
  editor: Editor,
  pos: number,
  direction: MoveDirection
): boolean {
  const { state } = editor;
  const $pos = state.doc.resolve(pos);
  if ($pos.depth !== 0) return false;
  const parent = $pos.node(0);
  const index = $pos.index(0);
  if (direction === "up") return index > 0;
  return index < parent.childCount - 1;
}
