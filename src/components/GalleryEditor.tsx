"use client";

import { useRef, useState } from "react";
import Image from "next/image";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uploadAndProcess } from "@/lib/upload-client";
import type { GalleryItem } from "@/lib/types";

type Props = {
  label?: string;
  gallery: GalleryItem[];
  onGalleryChange: (g: GalleryItem[]) => void;
  heroUrl: string;
  onHeroChange: (url: string) => void;
  socialCoverUrl: string | null;
  onSocialCoverChange: (url: string | null) => void;
};

type Pending = {
  id: string;
  name: string;
  status: "uploading" | "processing" | "error";
  error?: string;
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function GalleryEditor({
  label,
  gallery,
  onGalleryChange,
  heroUrl,
  onHeroChange,
  socialCoverUrl,
  onSocialCoverChange
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function appendItem(item: GalleryItem) {
    onGalleryChange([...gallery, item]);
  }

  function updateItem(url: string, patch: Partial<GalleryItem>) {
    onGalleryChange(gallery.map((g) => (g.url === url ? { ...g, ...patch } : g)));
  }

  function removeItem(url: string) {
    onGalleryChange(gallery.filter((g) => g.url !== url));
    if (socialCoverUrl === url) onSocialCoverChange(null);
  }

  function setAsHero(url: string) {
    // Swap: clicked item becomes the hero; current hero (if any) drops into the gallery.
    const item = gallery.find((g) => g.url === url);
    if (!item) return;
    const remaining = gallery.filter((g) => g.url !== url);
    if (heroUrl) {
      remaining.push({ url: heroUrl, caption: null });
    }
    onGalleryChange(remaining);
    onHeroChange(url);
  }

  function toggleSocialCover(url: string) {
    onSocialCoverChange(socialCoverUrl === url ? null : url);
  }

  async function uploadOne(file: File) {
    const id = newId();
    setPending((p) => [...p, { id, name: file.name, status: "uploading" }]);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 60_000);
    try {
      const result = await uploadAndProcess(file, abort.signal);
      appendItem({ url: result.url, caption: null });
      setPending((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      const msg =
        err instanceof Error
          ? abort.signal.aborted
            ? "Upload timed out after 60s"
            : err.message
          : "Upload failed";
      console.error("[GalleryEditor] upload failed:", err);
      setPending((p) =>
        p.map((x) => (x.id === id ? { ...x, status: "error", error: msg } : x))
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Parallel uploads — Promise.allSettled so one failure doesn't cancel the rest.
    const arr = Array.from(files);
    void Promise.allSettled(arr.map((f) => uploadOne(f)));
  }

  function dismissPending(id: string) {
    setPending((p) => p.filter((x) => x.id !== id));
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (gallery.some((g) => g.url === url)) {
      setUrlInput("");
      return;
    }
    appendItem({ url, caption: null });
    setUrlInput("");
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = gallery.findIndex((g) => g.url === active.id);
    const newIndex = gallery.findIndex((g) => g.url === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onGalleryChange(arrayMove(gallery, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          {label}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={
          "border-2 border-dashed cursor-pointer text-center px-4 py-6 transition-colors " +
          (dragOver
            ? "border-accent bg-accent/5"
            : "border-black/20 bg-black/[0.02] hover:border-black/40")
        }
      >
        <p className="text-sm">
          <span className="font-medium">Drop images</span> or click to browse · multi-select OK
        </p>
        <p className="text-xs text-black/50 mt-1">
          Drag thumbnails to reorder · click ★ to make hero · click ⊕ to mark social cover
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Pending uploads */}
      {pending.length > 0 && (
        <ul className="text-xs space-y-1">
          {pending.map((p) => (
            <li
              key={p.id}
              className={
                "flex items-center justify-between gap-2 px-2 py-1 " +
                (p.status === "error" ? "bg-red-50 text-red-700" : "bg-black/5 text-black/70")
              }
            >
              <span className="truncate">
                {p.name}
                {p.status === "uploading" && " · uploading…"}
                {p.status === "processing" && " · processing…"}
                {p.status === "error" && ` · ${p.error}`}
              </span>
              {p.status === "error" && (
                <button
                  type="button"
                  onClick={() => dismissPending(p.id)}
                  className="text-red-700 hover:text-red-900 font-bold"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Sortable thumbnails */}
      {gallery.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={gallery.map((g) => g.url)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gallery.map((item) => (
                <SortableThumb
                  key={item.url}
                  item={item}
                  isSocial={item.url === socialCoverUrl}
                  onSetHero={() => setAsHero(item.url)}
                  onToggleSocial={() => toggleSocialCover(item.url)}
                  onCaptionChange={(c) => updateItem(item.url, { caption: c || null })}
                  onRemove={() => removeItem(item.url)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* URL paste fallback */}
      <div>
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className="text-xs uppercase tracking-widest text-black/50 hover:text-accent underline-offset-4 hover:underline"
        >
          {showUrl ? "Hide URL paste" : "Or paste a URL (MLS link, etc.)"}
        </button>
        {showUrl && (
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
            />
            <button
              type="button"
              onClick={addUrl}
              className="px-4 py-2 text-xs uppercase tracking-widest border border-black/20 hover:border-accent hover:text-accent"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableThumb({
  item,
  isSocial,
  onSetHero,
  onToggleSocial,
  onCaptionChange,
  onRemove
}: {
  item: GalleryItem;
  isSocial: boolean;
  onSetHero: () => void;
  onToggleSocial: () => void;
  onCaptionChange: (caption: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.url
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-black/10 bg-white">
      <div className="relative group aspect-square overflow-hidden bg-black/5">
        {/* Drag handle covers the image; mouse-down begins drag (5px threshold). */}
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        />
        <Image
          src={item.url}
          alt={item.caption ?? ""}
          fill
          sizes="200px"
          className="object-cover pointer-events-none"
          unoptimized
        />

        {/* Badges (top-left) */}
        {isSocial && (
          <span className="absolute top-1 left-1 text-[10px] uppercase tracking-widest bg-accent text-ink px-1.5 py-0.5 z-10">
            Social
          </span>
        )}

        {/* Action buttons (top-right). Always visible on touch (sm:opacity-0); show on hover on desktop. */}
        <div className="absolute top-1 right-1 flex gap-1 z-10 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetHero();
            }}
            title="Set as hero"
            aria-label="Set as hero"
            className="bg-black/70 text-white px-1.5 py-1 leading-none hover:bg-accent"
          >
            <StarIcon />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSocial();
            }}
            title={isSocial ? "Unset social cover" : "Set as social cover"}
            aria-label="Toggle social cover"
            aria-pressed={isSocial}
            className={
              "px-1.5 py-1 leading-none " +
              (isSocial
                ? "bg-accent text-ink"
                : "bg-black/70 text-white hover:bg-accent")
            }
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove"
            aria-label="Remove"
            className="bg-black/70 text-white px-1.5 py-1 leading-none hover:bg-red-600"
          >
            ×
          </button>
        </div>
      </div>

      <input
        type="text"
        value={item.caption ?? ""}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Caption…"
        className="w-full px-2 py-1.5 text-xs border-t border-black/10 focus:bg-accent/5 focus:outline-none"
      />
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.9 6.9L22 10l-5.5 4.7L18 22l-6-3.6L6 22l1.5-7.3L2 10l7.1-1.1L12 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
