import Image from "next/image";
import type { HeroPhoto } from "@/lib/types";

/**
 * Asymmetric photo mosaic for the /agents hero. Server component (no
 * interactivity — purely decorative). Pulls from hero_photos; degrades
 * gracefully with 3 or 4 photos, caps at 5.
 *
 * Shape intentionally varies: one big 2x2 anchor plus 3-4 smaller tiles,
 * not a uniform grid. The editorial look comes from the asymmetry.
 *
 * Renders nothing if fewer than 3 photos are available — the parent is
 * expected to fall back to a text-only hero in that case.
 */
export function HeroMosaic({ photos }: { photos: HeroPhoto[] }) {
  if (photos.length < 3) return null;

  // Cap at 5 photos on desktop. Mobile shows 3-4 in a simpler grid.
  const p = photos.slice(0, 5);

  return (
    <div className="relative w-full">
      {/* Desktop: asymmetric grid. Mobile (< md): simple 2-col grid. */}
      <div className="hidden md:block">
        <DesktopMosaic photos={p} />
      </div>
      <div className="md:hidden">
        <MobileMosaic photos={p.slice(0, 4)} />
      </div>

      {/* Vignette — radial gradient fades tile edges into the black hero bg
          instead of a hard photo-edge stop. Sits above tiles, below any
          future interactive content; pointer-events-none so hover falls through. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.6) 100%)"
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function DesktopMosaic({ photos }: { photos: HeroPhoto[] }) {
  const n = photos.length;

  // Three distinct layouts — fewer photos get a layout that fills cleanly
  // rather than leaving a dead cell.
  if (n === 3) {
    // ┌────┬────┐
    // │    │ B  │
    // │ A  ├────┤
    // │    │ C  │
    // └────┴────┘
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-1 aspect-[4/5]">
        <Tile photo={photos[0]} className="row-span-2" />
        <Tile photo={photos[1]} />
        <Tile photo={photos[2]} />
      </div>
    );
  }
  if (n === 4) {
    // ┌─────────┬────┐
    // │         │ B  │
    // │   A     ├────┤
    // │         │ C  │
    // ├────┬────┴────┤
    // │ D (wide)     │  (spans both cols)
    // └──────────────┘
    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1 aspect-[4/3]">
        <Tile photo={photos[0]} className="col-span-2 row-span-2" />
        <Tile photo={photos[1]} />
        <Tile photo={photos[2]} />
        <Tile photo={photos[3]} className="col-span-3" />
      </div>
    );
  }
  // 5 photos: classic editorial layout.
  // ┌─────────┬────┬────┐
  // │         │ B  │ C  │
  // │   A     ├────┼────┤
  // │         │ D  │ E  │
  // └─────────┴────┴────┘
  return (
    <div className="grid grid-cols-4 grid-rows-2 gap-1 aspect-[4/3]">
      <Tile photo={photos[0]} className="col-span-2 row-span-2" priority />
      <Tile photo={photos[1]} />
      <Tile photo={photos[2]} />
      <Tile photo={photos[3]} />
      <Tile photo={photos[4]} />
    </div>
  );
}

function MobileMosaic({ photos }: { photos: HeroPhoto[] }) {
  const n = photos.length;
  if (n >= 4) {
    // 2x2 grid of first 4 photos.
    return (
      <div className="grid grid-cols-2 gap-1">
        {photos.slice(0, 4).map((photo) => (
          <Tile key={photo.id} photo={photo} className="aspect-square" />
        ))}
      </div>
    );
  }
  // 3 photos: one big on top, two below.
  return (
    <div className="grid grid-cols-2 gap-1">
      <Tile photo={photos[0]} className="col-span-2 aspect-[16/10]" />
      <Tile photo={photos[1]} className="aspect-square" />
      <Tile photo={photos[2]} className="aspect-square" />
    </div>
  );
}

function Tile({
  photo,
  className = "",
  priority = false
}: {
  photo: HeroPhoto;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={
        "relative border border-white/10 rounded-sm overflow-hidden bg-ink " + className
      }
    >
      <Image
        src={photo.url}
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover saturate-[0.8] hover:saturate-100 transition-[filter] duration-500"
        unoptimized
      />
    </div>
  );
}
