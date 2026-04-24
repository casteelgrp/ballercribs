"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GalleryAttrs, GalleryItem } from "./editor-extensions/Gallery";

type WorkItem = {
  id: string;
  url: string;
  caption: string;
  width?: number;
  height?: number;
  status: "idle" | "uploading" | "error";
  error?: string;
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

/**
 * Modal for inserting / editing a blog gallery. Multi-file upload with
 * dnd-kit vertical reorder (same pattern as listings GalleryEditor),
 * caption per image, live upload state, per-item remove.
 *
 * Not a <form onSubmit> — this modal renders inside BlogForm's form and
 * nested forms are invalid HTML. Insert wires to an onClick handler;
 * Enter is intentionally not bound (multi-field modal, Enter-to-submit
 * would be surprising).
 */
export function BlogGalleryModal({
  open,
  initial,
  onSave,
  onClose
}: {
  open: boolean;
  initial: GalleryAttrs | null;
  onSave: (attrs: GalleryAttrs) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Reset when modal opens so a re-open shows the latest `initial`
  // instead of a previous session's work.
  useEffect(() => {
    if (!open) return;
    const existing = (initial?.images ?? []).map<WorkItem>((img) => ({
      id: newId(),
      url: img.url,
      caption: img.caption ?? "",
      width: img.width,
      height: img.height,
      status: "idle"
    }));
    setItems(existing);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const uploading = items.some((i) => i.status === "uploading");
  const anyReady = items.some((i) => i.status === "idle");
  // Insert is enabled when at least one ready item exists and nothing is
  // still uploading — keeps failed-only states from inserting empty.
  const canInsert = anyReady && !uploading;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    // Seed placeholder rows first so ordering is stable with the order
    // the user picked. Each row gets its own id so a slow upload can't
    // collide with a fast one.
    const seeded: WorkItem[] = list.map((file) => ({
      id: newId(),
      url: "",
      caption: "",
      status: "uploading" as const,
      _file: file
    })) as unknown as WorkItem[];
    setItems((prev) => [...prev, ...seeded]);

    // Kick off uploads in parallel. Each completion does a functional
    // setState update keyed on id — critical for parallel completions
    // where a closure snapshot of `items` would be stale.
    seeded.forEach((row, idx) => {
      void uploadOne(row.id, list[idx]);
    });
  }

  async function uploadOne(itemId: string, file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: fd
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, status: "error", error: data.error || "Upload failed" }
              : i
          )
        );
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, status: "idle", url: data.url as string, caption: i.caption }
            : i
        )
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: "error",
                error: err instanceof Error ? err.message : "Upload failed"
              }
            : i
        )
      );
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateCaption(id: string, caption: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, caption } : i)));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function commit() {
    if (!canInsert) return;
    // Only emit ready items — failed/uploading rows drop. The parent
    // node's images attr stays typed as GalleryItem[] without status.
    const images: GalleryItem[] = items
      .filter((i) => i.status === "idle" && i.url)
      .map((i) => ({
        url: i.url,
        caption: i.caption.trim(),
        width: i.width,
        height: i.height
      }));
    if (images.length === 0) return;
    onSave({ images });
  }

  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit gallery" : "Insert gallery"}
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white max-w-2xl w-full border border-black/10 p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">
            {initial ? "Edit gallery" : "Insert gallery"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 hover:text-black text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div>
          <span className={labelClass}>Images</span>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : "Upload images"}
            </button>
            <span className="text-[10px] uppercase tracking-widest text-black/40">
              multi-select supported
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-black/15 py-8 text-center text-sm text-black/50">
            No images yet. Click Upload images to add one or more.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {items.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onCaptionChange={(c) => updateCaption(item.id, c)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={commit}
            disabled={!canInsert}
            className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {initial ? "Save changes" : "Insert gallery"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-black/20 px-5 py-2 text-sm uppercase tracking-widest hover:border-black/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** One row in the reorderable list: drag handle, thumbnail, caption, remove. */
function SortableRow({
  item,
  onCaptionChange,
  onRemove
}: {
  item: WorkItem;
  onCaptionChange: (c: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border border-black/10 bg-white p-2"
    >
      {/* Drag handle — stays out of the caption input so typing doesn't
          accidentally initiate a drag. */}
      <button
        type="button"
        className="text-black/30 hover:text-black/70 cursor-grab active:cursor-grabbing px-1 py-2"
        aria-label="Reorder image"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <div className="relative w-16 h-16 bg-black/5 border border-black/10 overflow-hidden flex-shrink-0">
        {item.status === "uploading" ? (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-black/50">
            Uploading
          </div>
        ) : item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.caption || ""}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-red-600">
            Failed
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={item.caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Optional caption"
          disabled={item.status !== "idle"}
          className="w-full border border-black/20 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none disabled:bg-black/5"
        />
        {item.status === "error" && (
          <p className="mt-1 text-xs text-red-600">{item.error}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="text-xs uppercase tracking-widest border border-black/20 px-3 py-1.5 hover:border-red-500 hover:text-red-600 transition-colors"
      >
        Remove
      </button>
    </li>
  );
}
