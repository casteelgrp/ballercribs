"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { PropertyCard, type PropertyCardAttrs } from "./editor-extensions/PropertyCard";
import { BlogPropertyCardModal } from "./BlogPropertyCardModal";

type ModalState = {
  open: boolean;
  /** Non-null when editing an existing card; null when inserting a new one. */
  pos: number | null;
  initial: PropertyCardAttrs | null;
};

const EMPTY_MODAL: ModalState = { open: false, pos: null, initial: null };

// Persistence key for the resize handle. Any non-numeric / non-positive
// value in localStorage is ignored on mount; the CSS default (70vh) is
// used and the handle re-initializes on next drag.
const HEIGHT_LS_KEY = "blog-editor-height";

/**
 * Wrapper around TipTap's useEditor that owns the toolbar + property-card
 * modal. The surrounding form is agnostic of editor internals — it passes
 * initial JSON content in and gets `(bodyJson, bodyHtml)` back via
 * onChange whenever the document updates.
 *
 * body_html is generated client-side via editor.getHTML() and posted as
 * part of the form payload. The server sanitizes it with DOMPurify
 * before writing to the DB (belt + suspenders: our own editor output is
 * not supposed to contain hostile markup, but we treat it as untrusted
 * anyway).
 */
export function BlogEditor({
  initialContent,
  onChange,
  disabled = false
}: {
  initialContent: unknown | null;
  onChange: (bodyJson: unknown, bodyHtml: string) => void;
  disabled?: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Resize state. `heightPx = null` means "use the CSS default
  // (h-[70vh])" — SSR and the first client render both see null, which
  // keeps the rendered markup identical and avoids hydration mismatch.
  // heightPxRef mirrors the state for listener closures (window
  // listeners registered on mousedown don't re-bind on each render).
  const [heightPx, setHeightPx] = useState<number | null>(null);
  const heightPxRef = useRef<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const editor = useEditor({
    editable: !disabled,
    // SSR note: immediatelyRender=false avoids a React hydration mismatch
    // when the editor first mounts — TipTap 3's default is true and
    // emits initial content server-side, which fights Next.js client
    // hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Keep the StarterKit link mark off — we configure our own so
        // outbound attrs (target + rel) are consistent.
        link: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" }
      }),
      Image,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      PropertyCard
    ],
    content: initialContent ?? "",
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getHTML());
    }
  });

  // Wire the PropertyCard storage callback so the NodeView's Edit button
  // opens our modal pre-filled. Re-runs if the editor instance changes
  // (StrictMode double-mount, HMR).
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.propertyCard as {
      onEditRequest: null | ((pos: number, attrs: PropertyCardAttrs) => void);
    };
    storage.onEditRequest = (pos, attrs) => {
      setModal({ open: true, pos, initial: attrs });
    };
    return () => {
      storage.onEditRequest = null;
    };
  }, [editor]);

  // Hydrate the editor height from localStorage after mount. Running
  // inside useEffect keeps the SSR/pre-hydration render deterministic
  // (heightPx stays null, CSS default 70vh applies); any persisted
  // value only shows up on the next client paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HEIGHT_LS_KEY);
      if (raw === null) return;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) setHeightPx(n);
    } catch {
      // localStorage unavailable (Safari private mode, quota, etc.) —
      // silently fall back to the default. Not worth surfacing a UI
      // warning for an author tool.
    }
  }, []);

  // Keep the ref in sync with state so the mouseup handler can read the
  // final dragged value without stale-closure footguns. Ref-first writes
  // in onMove also keep the persist-on-mouseup path accurate even if a
  // render hasn't flushed yet.
  useEffect(() => {
    heightPxRef.current = heightPx;
  }, [heightPx]);

  function onHandleMouseDown(e: React.MouseEvent) {
    // preventDefault kills the native text-selection drag that would
    // otherwise start on mousedown — keeps the editor selection intact.
    e.preventDefault();
    const startHeight =
      heightPxRef.current ?? Math.round(window.innerHeight * 0.7);
    dragRef.current = { startY: e.clientY, startHeight };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = ev.clientY - dragRef.current.startY;
      const minPx = window.innerHeight * 0.4;
      const next = Math.max(minPx, dragRef.current.startHeight + delta);
      heightPxRef.current = next;
      setHeightPx(next);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dragRef.current = null;
      try {
        const final = heightPxRef.current;
        if (final !== null) {
          localStorage.setItem(HEIGHT_LS_KEY, String(Math.round(final)));
        }
      } catch {
        // Persistence failure is non-fatal — the in-memory height still
        // applies for this session.
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onHandleDoubleClick() {
    try {
      localStorage.removeItem(HEIGHT_LS_KEY);
    } catch {
      // Same as above — removeItem failure is non-fatal.
    }
    setHeightPx(null);
  }

  function insertCard() {
    setModal({ open: true, pos: null, initial: null });
  }

  function savePropertyCard(attrs: PropertyCardAttrs) {
    if (!editor) return;
    if (modal.pos !== null) {
      editor.chain().focus().updatePropertyCardAt(modal.pos, attrs).run();
    } else {
      editor.chain().focus().insertPropertyCard(attrs).run();
    }
    setModal(EMPTY_MODAL);
  }

  async function handleImageFile(file: File) {
    if (!editor) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: fd
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        window.alert(data.error || "Upload failed");
        return;
      }
      editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
    } finally {
      setUploading(false);
    }
  }

  function promptLink() {
    if (!editor) return;
    const prev = (editor.getAttributes("link") as { href?: string })?.href || "";
    const url = window.prompt("Link URL (empty to remove)", prev);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  if (!editor) {
    return (
      <div className="border border-black/20 bg-white min-h-[300px] flex items-center justify-center text-sm text-black/40">
        Loading editor…
      </div>
    );
  }

  const btn = (active: boolean) =>
    "px-2.5 py-1.5 text-xs uppercase tracking-widest transition-colors disabled:opacity-40 " +
    (active
      ? "bg-ink text-paper"
      : "bg-white border border-black/10 hover:border-black/40 text-black/70");

  return (
    <div className="border border-black/20 bg-white">
      {/* Toolbar pins to the viewport (top-16 matches SiteHeader's h-16)
          while the editor container is in view. bg-paper is opaque so
          inline content doesn't bleed through when scrolled; z-20 keeps
          it below SiteHeader's z-40. Unsticks automatically when the
          outer container scrolls past. */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-black/10 bg-paper sticky top-16 z-20">
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold")) + " font-bold"}
        >
          B
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic")) + " italic"}
        >
          I
        </button>
        <span className="w-px bg-black/10 mx-1" aria-hidden="true" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
        >
          • List
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
        >
          1. List
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btn(editor.isActive("blockquote"))}
        >
          Quote
        </button>
        <span className="w-px bg-black/10 mx-1" aria-hidden="true" />
        <button
          type="button"
          disabled={disabled}
          onClick={promptLink}
          className={btn(editor.isActive("link"))}
        >
          Link
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          className={btn(false)}
        >
          {uploading ? "Uploading…" : "Image"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={insertCard}
          className={btn(false)}
        >
          + Property
        </button>
        <span className="w-px bg-black/10 mx-1" aria-hidden="true" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={btn(false)}
        >
          — HR
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().undo().run()}
          className={btn(false)}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().redo().run()}
          className={btn(false)}
        >
          Redo
        </button>
      </div>

      {/* Hidden file input wired to the Image toolbar button. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageFile(file);
          e.target.value = "";
        }}
      />

      {/* Editor surface. Fixed-height pane (h-[70vh] default, persistable
          via the drag handle below) so the page doesn't stretch on long
          posts. Content scrolls internally below the sticky toolbar —
          the toolbar's sticky context is the outer wrapper, not this
          scroll container, so internal scrolling doesn't affect it.
          ProseMirror detects the nearest scrollable ancestor for
          caret-into-view. Inline style overrides the Tailwind height
          class when heightPx is non-null (user has dragged or a
          persisted value was loaded). */}
      <EditorContent
        editor={editor}
        className="p-4 h-[70vh] overflow-y-auto"
        style={heightPx !== null ? { height: `${heightPx}px` } : undefined}
      />

      {/* Vertical-only resize handle. Drag changes height + persists to
          localStorage on mouseup; double-click resets to the 70vh
          default. Min clamped to 40vh on drag so it can't shrink to
          uselessness; no upper bound per spec. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor (double-click to reset)"
        onMouseDown={onHandleMouseDown}
        onDoubleClick={onHandleDoubleClick}
        className="h-2 border-t border-black/10 bg-black/5 hover:bg-black/10 cursor-ns-resize"
      />

      <BlogPropertyCardModal
        open={modal.open}
        initial={modal.initial}
        onSave={savePropertyCard}
        onClose={() => setModal(EMPTY_MODAL)}
      />
    </div>
  );
}
