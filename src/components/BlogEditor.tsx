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

      {/* Max-height caps the editor surface at ~70vh so a long post
          doesn't stretch the page to monstrous heights. Content scrolls
          internally below the (still-sticky, outside this scroll
          container) toolbar. ProseMirror detects the nearest scrollable
          ancestor for caret-into-view, so typing past the fold still
          scrolls correctly. */}
      <EditorContent editor={editor} className="p-4 max-h-[70vh] overflow-y-auto" />

      <BlogPropertyCardModal
        open={modal.open}
        initial={modal.initial}
        onSave={savePropertyCard}
        onClose={() => setModal(EMPTY_MODAL)}
      />
    </div>
  );
}
