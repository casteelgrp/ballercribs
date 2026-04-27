"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { BlogImage, type BlogImageAttrs } from "./editor-extensions/BlogImage";
import { PropertyCard, type PropertyCardAttrs } from "./editor-extensions/PropertyCard";
import { Gallery, type GalleryAttrs } from "./editor-extensions/Gallery";
import { VideoEmbed, type VideoEmbedAttrs } from "./editor-extensions/VideoEmbed";
import { BlogImageAttrsModal } from "./BlogImageAttrsModal";
import { BlogPropertyCardModal } from "./BlogPropertyCardModal";
import { BlogGalleryModal } from "./BlogGalleryModal";
import { BlogVideoEmbedModal } from "./BlogVideoEmbedModal";
import { BlogLinkBubbleMenu } from "./BlogLinkBubbleMenu";

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
  const [galleryModal, setGalleryModal] = useState<{
    open: boolean;
    pos: number | null;
    initial: GalleryAttrs | null;
  }>({ open: false, pos: null, initial: null });
  const [videoModal, setVideoModal] = useState<{
    open: boolean;
    pos: number | null;
    initial: VideoEmbedAttrs | null;
  }>({ open: false, pos: null, initial: null });
  const [imageModal, setImageModal] = useState<{
    open: boolean;
    pos: number | null;
    initial: BlogImageAttrs | null;
  }>({ open: false, pos: null, initial: null });
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
    // TipTap 3 defaults shouldRerenderOnTransaction to false; without it,
    // toolbar buttons that read `editor.isActive(...)` paint their state
    // at mount and never update. Cursor in an H2 wouldn't highlight the
    // H2 button because the parent doesn't re-render on selection
    // change. Per-keystroke re-renders are fine on this admin-only
    // surface — the buttons' className branches are cheap.
    shouldRerenderOnTransaction: true,
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
        // Null defaults so per-link `target` lives on the mark rather
        // than being auto-stamped from a global config. The link
        // bubble menu's "New window" toggle owns the target value;
        // existing links round-trip via parseHTML's auto-extraction
        // of target/rel from saved <a> tags, so no regression to
        // already-published posts (every existing link has
        // target="_blank" rel="noopener noreferrer" hardcoded in
        // body_html — confirmed via curl on prod).
        HTMLAttributes: { target: null, rel: null }
      }),
      BlogImage,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      PropertyCard,
      Gallery,
      VideoEmbed
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

  // Same pattern for Gallery — NodeView's Edit pill bubbles up to open
  // the modal pre-filled via the extension's storage.
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.gallery as {
      onEditRequest: null | ((pos: number, attrs: GalleryAttrs) => void);
    };
    storage.onEditRequest = (pos, attrs) => {
      setGalleryModal({ open: true, pos, initial: attrs });
    };
    return () => {
      storage.onEditRequest = null;
    };
  }, [editor]);

  // And for VideoEmbed — same storage-callback plumbing.
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.videoEmbed as {
      onEditRequest: null | ((pos: number, attrs: VideoEmbedAttrs) => void);
    };
    storage.onEditRequest = (pos, attrs) => {
      setVideoModal({ open: true, pos, initial: attrs });
    };
    return () => {
      storage.onEditRequest = null;
    };
  }, [editor]);

  // BlogImage — Edit pill on the inline-image NodeView opens the
  // alt + caption modal pre-filled with the current attrs. Storage
  // is keyed `image` (matches the extension's name) so existing
  // posts' {type: "image"} nodes hydrate against the same slot;
  // PropertyCard / Gallery / VideoEmbed each use their own name.
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.image as {
      onEditRequest: null | ((pos: number, attrs: BlogImageAttrs) => void);
    };
    storage.onEditRequest = (pos, attrs) => {
      setImageModal({ open: true, pos, initial: attrs });
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

  function insertGallery() {
    setGalleryModal({ open: true, pos: null, initial: null });
  }

  function saveGallery(attrs: GalleryAttrs) {
    if (!editor) return;
    if (galleryModal.pos !== null) {
      editor.chain().focus().updateGalleryAt(galleryModal.pos, attrs).run();
    } else {
      editor.chain().focus().insertGallery(attrs).run();
    }
    setGalleryModal({ open: false, pos: null, initial: null });
  }

  function insertVideo() {
    setVideoModal({ open: true, pos: null, initial: null });
  }

  function saveVideo(attrs: VideoEmbedAttrs) {
    if (!editor) return;
    if (videoModal.pos !== null) {
      editor.chain().focus().updateVideoEmbedAt(videoModal.pos, attrs).run();
    } else {
      editor.chain().focus().insertVideoEmbed(attrs).run();
    }
    setVideoModal({ open: false, pos: null, initial: null });
  }

  function saveImageAttrs(attrs: BlogImageAttrs) {
    if (!editor) return;
    if (imageModal.pos !== null) {
      editor.chain().focus().updateInlineImageAt(imageModal.pos, attrs).run();
    }
    setImageModal({ open: false, pos: null, initial: null });
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
      // Insert with empty alt — auto-filling the filename ("DSC_0847.webp")
      // tells screen readers garbage. Empty is more honest. Author opens
      // the image's Edit pill afterwards to fill in alt + an optional
      // caption via BlogImageAttrsModal.
      editor.chain().focus().setImage({ src: data.url, alt: "" }).run();
    } finally {
      setUploading(false);
    }
  }

  function promptLink() {
    if (!editor) return;
    const prev = (editor.getAttributes("link") as { href?: string })?.href || "";
    // Toolbar button only handles the initial "add link" path —
    // editing an existing link's URL + target now flows through the
    // BlogLinkBubbleMenu inspector that shows on link selection.
    const url = window.prompt("Link URL (empty to remove)", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    // New links default to same-tab — historical config auto-stamped
    // target="_blank" on every link via Link.HTMLAttributes; that
    // default is now off so the author opts in via the bubble menu's
    // "New window" toggle for outbound references.
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
        <button
          type="button"
          disabled={disabled}
          onClick={insertGallery}
          className={btn(false)}
        >
          + Gallery
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={insertVideo}
          className={btn(false)}
        >
          + Video
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

      {/* Link inspector — floats above any link the cursor sits inside.
          Mounted under the toolbar so its placement context is the
          editor surface, not the page. */}
      <BlogLinkBubbleMenu editor={editor} />

      {/* Editor surface. Fixed-height pane (h-[70vh] default, persistable
          via the corner grip below) so the page doesn't stretch on long
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

      {/* Resize grip row — sibling below the scroll container so the
          grip sits outside the editor's scrolling area (matches the
          listings native-textarea pattern where the grip lives at the
          corner, integrated with the surface). No divider / no tint so
          the row reads as a seamless continuation of the editor, not a
          distinct footer strip. */}
      <div className="flex justify-end px-2 py-1.5">
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize editor (double-click to reset)"
          onMouseDown={onHandleMouseDown}
          onDoubleClick={onHandleDoubleClick}
          className="group w-3.5 h-3.5 cursor-ns-resize"
        >
          <svg
            viewBox="0 0 14 14"
            className="w-full h-full"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line
              x1="1" y1="13" x2="13" y2="1"
              className="stroke-black/60 group-hover:stroke-black/70 transition-colors"
            />
            <line
              x1="5" y1="13" x2="13" y2="5"
              className="stroke-black/60 group-hover:stroke-black/70 transition-colors"
            />
            <line
              x1="9" y1="13" x2="13" y2="9"
              className="stroke-black/60 group-hover:stroke-black/70 transition-colors"
            />
          </svg>
        </div>
      </div>

      <BlogPropertyCardModal
        open={modal.open}
        initial={modal.initial}
        onSave={savePropertyCard}
        onClose={() => setModal(EMPTY_MODAL)}
      />

      <BlogGalleryModal
        open={galleryModal.open}
        initial={galleryModal.initial}
        onSave={saveGallery}
        onClose={() => setGalleryModal({ open: false, pos: null, initial: null })}
      />

      <BlogVideoEmbedModal
        open={videoModal.open}
        initial={videoModal.initial}
        onSave={saveVideo}
        onClose={() => setVideoModal({ open: false, pos: null, initial: null })}
      />

      <BlogImageAttrsModal
        open={imageModal.open}
        initial={imageModal.initial}
        onSave={saveImageAttrs}
        onClose={() => setImageModal({ open: false, pos: null, initial: null })}
      />
    </div>
  );
}
