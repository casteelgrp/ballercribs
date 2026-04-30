"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

import type { GalleryItem } from "@/lib/types";

type LightboxCtx = {
  /** Open the lightbox at the given slide index. */
  open: (index: number) => void;
};

const Ctx = createContext<LightboxCtx | null>(null);

function useListingLightbox(): LightboxCtx {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("ListingHeroImage / ListingGalleryGrid must be inside <ListingMediaProvider>");
  return ctx;
}

/**
 * Wraps the listing page content so any inner image trigger can open the
 * lightbox. Hero is always slide 0; gallery items are slides 1..N.
 */
export function ListingMediaProvider({
  heroUrl,
  altBase,
  gallery,
  children
}: {
  heroUrl: string;
  altBase: string;
  gallery: GalleryItem[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState(-1);

  const slides = useMemo(
    () => [
      { src: heroUrl, alt: altBase, description: undefined },
      ...gallery.map((g) => ({
        src: g.url,
        alt: g.caption ?? altBase,
        description: g.caption ?? undefined
      }))
    ],
    [heroUrl, altBase, gallery]
  );

  return (
    <Ctx.Provider value={{ open: setIndex }}>
      {children}
      <Lightbox
        open={index >= 0}
        index={Math.max(0, index)}
        close={() => setIndex(-1)}
        slides={slides}
        plugins={[Zoom, Captions]}
        carousel={{ preload: 2, finite: true }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
        styles={{ container: { backgroundColor: "rgba(0, 0, 0, 1)" } }}
      />
    </Ctx.Provider>
  );
}

/** Clickable hero image — opens the lightbox at slide 0. */
export function ListingHeroImage({
  src,
  alt,
  soldLabel
}: {
  src: string;
  alt: string;
  /** When set, renders a SOLD pill over the top-right of the hero. */
  soldLabel?: string;
}) {
  const { open } = useListingLightbox();
  return (
    <button
      type="button"
      onClick={() => open(0)}
      aria-label={`View ${alt} fullscreen`}
      className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-black/5 cursor-zoom-in block overflow-hidden"
    >
      {/* object-position center 65% shifts the focal point down so
          landscape aerials (subject usually in the lower third)
          survive the wide/short hero crop. Default center-center
          was burying the house on aerial-shot listings like
          /listings/lake-arrowhead-vt-modern-farmhouse-estate. */}
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_65%]"
      />
      {soldLabel && (
        <span className="pointer-events-none absolute top-4 right-4 sm:top-6 sm:right-6 bg-red-600 text-white text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] px-4 py-2 shadow-lg">
          {soldLabel}
        </span>
      )}
    </button>
  );
}

/** Clickable gallery grid — each thumb opens the lightbox at its slide index. */
export function ListingGalleryGrid({
  gallery,
  altBase
}: {
  gallery: GalleryItem[];
  altBase: string;
}) {
  const { open } = useListingLightbox();
  if (gallery.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {gallery.map((item, i) => (
        <figure key={item.url}>
          <button
            type="button"
            onClick={() => open(i + 1)}
            aria-label={`View ${item.caption ?? altBase} fullscreen`}
            className="relative aspect-[4/3] bg-black/5 overflow-hidden cursor-zoom-in block w-full"
          >
            <Image
              src={item.url}
              alt={item.caption ?? `${altBase} — photo ${i + 2}`}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          </button>
          {item.caption && (
            <figcaption className="text-xs text-black/60 mt-1.5 whitespace-pre-line">
              {item.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
