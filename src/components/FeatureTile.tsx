"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

/**
 * A 'Recent features' tile. Photo is the primary visual. A small 'View stats'
 * chip in the bottom-right corner opens a lightbox with the Instagram Insights
 * screenshot — pinch-to-zoom works on mobile for reading the numbers.
 *
 * The chip shows on hover (desktop) and is always visible on touch. Photo is
 * decorative — only the chip opens the lightbox.
 *
 * Photo also degrades to a dark 'Coming soon' block if the file 404s so the
 * layout never shows a broken-image icon.
 */
export function FeatureTile({
  photoSrc,
  statsSrc,
  caption,
  stats,
  label
}: {
  photoSrc: string;
  statsSrc: string;
  caption: string;
  stats: string;
  label?: string;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <figure className="space-y-3">
      <div className="relative aspect-square bg-ink overflow-hidden">
        {photoFailed ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs uppercase tracking-widest text-paper/50">Coming soon</span>
          </div>
        ) : (
          <>
            {/* Photo is decorative — no click handler. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={caption}
              onError={() => setPhotoFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* View-stats chip. Always visible across breakpoints — this is a
                key proof-point CTA on a sales page and mobile doesn't have hover
                so a hover-gated button would be invisible to half the audience.
                Color still shifts on hover for affordance. */}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`View Instagram Insights for ${caption}`}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-black/75 text-white text-[11px] uppercase tracking-widest px-2.5 py-1.5 hover:bg-accent hover:text-ink transition-colors"
            >
              <BarChartIcon />
              <span>View stats</span>
            </button>
          </>
        )}
      </div>
      <figcaption>
        {/* Label frames the tile so readers know whether they're looking at an
            outlier or a typical result. Small caps, muted — sets expectation
            without upstaging the numbers. */}
        {label && (
          <p className="text-[10px] uppercase tracking-widest text-accent mb-1.5">{label}</p>
        )}
        {/* Title is context; stats are the persuader. Muted regular-weight title
            above a bolder, smaller, ink stats line — flipped hierarchy. */}
        <p className="text-base font-normal text-black/70">{caption}</p>
        <p className="text-sm font-semibold text-ink mt-1">{stats}</p>
      </figcaption>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={[{ src: statsSrc, alt: `Instagram Insights — ${caption}` }]}
        plugins={[Zoom]}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
        styles={{ container: { backgroundColor: "rgba(0, 0, 0, 0.95)" } }}
        render={{
          // Single-slide: hide the prev/next arrows since they do nothing.
          buttonPrev: () => null,
          buttonNext: () => null
        }}
      />
    </figure>
  );
}

function BarChartIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
