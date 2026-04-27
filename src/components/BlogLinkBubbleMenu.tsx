"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";

/**
 * Inspector that floats above the active link mark. Shows the URL,
 * an Edit button, an Open-in-new-window toggle, and Remove. Replaces
 * the previous window.prompt-only flow.
 *
 * shouldShow returns true whenever the selection sits inside a link
 * mark — covers both "cursor in link" and "link selected". Hidden
 * otherwise so it doesn't compete with the toolbar.
 *
 * Reactivity: useEditorState subscribes to selection / transaction
 * updates and re-renders this component when href or target on the
 * active link mark change. Plain `editor.getAttributes("link")` in
 * render alone wouldn't re-fire when the cursor moves to a different
 * link without an unmount, since BubbleMenu reuses the wrapper node.
 */
export function BlogLinkBubbleMenu({ editor }: { editor: Editor }) {
  const linkAttrs = useEditorState({
    editor,
    selector: ({ editor }) => {
      const a = editor.getAttributes("link") as {
        href?: string;
        target?: string | null;
      };
      return {
        href: a.href ?? "",
        isNewWindow: a.target === "_blank"
      };
    }
  });

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor }) => editor.isActive("link")}
      // Above the link reads more naturally than BubbleMenu's default
      // (which centers vertically on the selection).
      options={{ placement: "top" }}
    >
      <div className="bg-paper border border-black/15 shadow-md flex items-center gap-2 p-1.5 text-xs max-w-[480px]">
        <a
          href={linkAttrs.href || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/70 hover:text-accent underline underline-offset-2 truncate max-w-[260px]"
          onClick={(e) => {
            // Suppress accidental clicks that would steal focus and
            // collapse selection — ctrl/cmd still works for "actually
            // visit this" if the author wants.
            if (!e.ctrlKey && !e.metaKey) e.preventDefault();
          }}
        >
          {linkAttrs.href || "(empty)"}
        </a>
        <span className="w-px h-4 bg-black/15" aria-hidden="true" />
        <button
          type="button"
          onClick={() => editLinkUrl(editor, linkAttrs)}
          className="px-2 py-1 hover:bg-black/5 transition-colors"
        >
          Edit
        </button>
        <label className="flex items-center gap-1.5 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={linkAttrs.isNewWindow}
            onChange={() => toggleNewWindow(editor, linkAttrs)}
            className="accent-accent"
          />
          <span>New window</span>
        </label>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
          className="px-2 py-1 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          Remove
        </button>
      </div>
    </BubbleMenu>
  );
}

function editLinkUrl(
  editor: Editor,
  current: { href: string; isNewWindow: boolean }
): void {
  const next = window.prompt("Link URL", current.href);
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({
      href: trimmed,
      target: current.isNewWindow ? "_blank" : null,
      rel: current.isNewWindow ? "noopener noreferrer" : null
    } as { href: string; target?: string | null; rel?: string | null })
    .run();
}

function toggleNewWindow(
  editor: Editor,
  current: { href: string; isNewWindow: boolean }
): void {
  const turningOn = !current.isNewWindow;
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({
      href: current.href,
      target: turningOn ? "_blank" : null,
      rel: turningOn ? "noopener noreferrer" : null
    } as { href: string; target?: string | null; rel?: string | null })
    .run();
}
