"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { HeroPhoto } from "@/lib/types";

const HERO_MAX_WIDTH = 2400;
const ORDER_DEBOUNCE_MS = 500;

type Pending = { id: string; name: string; status: "uploading" | "processing" | "error"; error?: string };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function HeroPhotosManager({ initial }: { initial: HeroPhoto[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<HeroPhoto[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function flashSaved(message: string) {
    setSavedToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSavedToast(null), 2500);
  }

  // ── Upload ─────────────────────────────────────────────────────────────
  async function uploadOne(file: File) {
    const id = newId();
    setPending((p) => [...p, { id, name: file.name, status: "uploading" }]);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 90_000);
    try {
      const result = await uploadAndProcess(file, abort.signal, { maxWidth: HERO_MAX_WIDTH });
      const res = await fetch("/api/admin/hero-photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: result.url })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      const data: { photo: HeroPhoto } = await res.json();
      setPhotos((p) => [...p, data.photo]);
      setPending((p) => p.filter((x) => x.id !== id));
      flashSaved("Uploaded");
      // Server data also refreshes so other tabs see it.
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? abort.signal.aborted
            ? "Upload timed out"
            : err.message
          : "Upload failed";
      console.error("[HeroPhotosManager] upload failed:", err);
      setPending((p) => p.map((x) => (x.id === id ? { ...x, status: "error", error: msg } : x)));
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    void Promise.allSettled(Array.from(files).map((f) => uploadOne(f)));
  }

  // ── Reorder (debounced PATCH) ──────────────────────────────────────────
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPhotos((prev) => {
      const oldIndex = prev.findIndex((p) => String(p.id) === String(active.id));
      const newIndex = prev.findIndex((p) => String(p.id) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      // Schedule a single bulk-save 500ms after the user stops reordering.
      // If they reorder again before 500ms elapses, the previous timer is cancelled.
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current);
      const orders = next.map((p, i) => ({ id: p.id, order: i }));
      orderTimerRef.current = setTimeout(() => {
        void persistOrders(orders);
      }, ORDER_DEBOUNCE_MS);
      return next;
    });
  }

  async function persistOrders(orders: Array<{ id: number; order: number }>) {
    try {
      const res = await fetch("/api/admin/hero-photos/order", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orders })
      });
      if (!res.ok) throw new Error(`Order save failed (${res.status})`);
      flashSaved("Order saved");
      router.refresh();
    } catch (err) {
      console.error("[HeroPhotosManager] order save failed:", err);
      setSavedToast("Order save failed — refresh and retry.");
    }
  }

  // Flush pending order save on unmount so a fast nav doesn't lose it.
  useEffect(() => {
    return () => {
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Active toggle / delete (immediate) ─────────────────────────────────
  async function toggleActive(photo: HeroPhoto) {
    const next = !photo.active;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, active: next } : p)));
    const res = await fetch(`/api/admin/hero-photos/${photo.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: next })
    });
    if (!res.ok) {
      // Rollback on failure
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, active: !next } : p)));
      window.alert("Toggle failed. Refresh and retry.");
      return;
    }
    flashSaved(next ? "Activated" : "Deactivated");
    router.refresh();
  }

  async function removePhoto(photo: HeroPhoto) {
    if (
      !window.confirm(
        `Delete this hero photo? It'll also be removed from rotation immediately. This can't be undone.`
      )
    )
      return;
    const prevPhotos = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    const res = await fetch(`/api/admin/hero-photos/${photo.id}`, { method: "DELETE" });
    if (!res.ok) {
      setPhotos(prevPhotos);
      window.alert("Delete failed. Refresh and retry.");
      return;
    }
    flashSaved("Deleted");
    router.refresh();
  }

  function dismissPending(id: string) {
    setPending((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
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
          "border-2 border-dashed cursor-pointer text-center px-4 py-8 transition-colors " +
          (dragOver
            ? "border-accent bg-accent/5"
            : "border-black/20 bg-black/[0.02] hover:border-black/40")
        }
      >
        <p className="text-sm">
          <span className="font-medium">Drop hero photos</span> or click to browse · multi-select OK
        </p>
        <p className="text-xs text-black/50 mt-1">
          Resized to 2400px wide WebP · max 100MB each · curated separately from listing photos
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

      {photos.length === 0 ? (
        <p className="text-sm text-black/50">
          No hero photos yet. Upload some — until then the homepage falls back to the original text hero.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map((photo, i) => (
                <SortablePhotoCard
                  key={photo.id}
                  photo={photo}
                  index={i}
                  onToggleActive={() => toggleActive(photo)}
                  onRemove={() => removePhoto(photo)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {savedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 border border-black/10 bg-black/85 text-white px-4 py-2 text-sm shadow-lg"
        >
          {savedToast}
        </div>
      )}
    </div>
  );
}

function SortablePhotoCard({
  photo,
  index,
  onToggleActive,
  onRemove
}: {
  photo: HeroPhoto;
  index: number;
  onToggleActive: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-black/10 bg-white">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
          aria-label="Drag to reorder"
        />
        <Image
          src={photo.url}
          alt={photo.caption ?? `Hero photo ${index + 1}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          className={"object-cover pointer-events-none " + (photo.active ? "" : "grayscale opacity-60")}
          unoptimized
        />
        {!photo.active && (
          <span className="absolute top-1 left-1 z-20 text-[10px] uppercase tracking-widest bg-black/70 text-white px-1.5 py-0.5">
            Inactive
          </span>
        )}
        <span className="absolute bottom-1 left-1 z-20 text-[10px] uppercase tracking-widest bg-white/90 text-ink px-1.5 py-0.5">
          #{index + 1}
        </span>
      </div>
      <div className="p-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={photo.active}
            onChange={onToggleActive}
            className="accent-accent"
          />
          Active
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-black/50 hover:text-red-600"
          aria-label="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
