"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { HeroPhoto } from "@/lib/types";

const ROTATE_INTERVAL_MS = 6000;

export function HeroCarousel({ photos }: { photos: HeroPhoto[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (photos.length <= 1 || paused || reduceMotion) return;
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % photos.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [photos.length, paused, reduceMotion]);

  if (photos.length === 0) return null;

  // If a previously-active idx is now past the end (e.g., a photo was deleted),
  // clamp without crashing. Render guard since useState init runs only once.
  const safeIdx = activeIdx < photos.length ? activeIdx : 0;

  return (
    <section className="relative w-full h-[60vh] sm:h-[75vh] lg:h-[85vh] overflow-hidden bg-ink">
      {photos.map((photo, i) => (
        <div
          key={photo.id}
          aria-hidden={i !== safeIdx}
          className={
            "absolute inset-0 transition-opacity duration-1000 ease-out " +
            (i === safeIdx ? "opacity-100" : "opacity-0")
          }
        >
          <Image
            src={photo.url}
            alt={photo.caption ? `Luxury home in ${photo.caption}` : ""}
            fill
            sizes="100vw"
            priority={i === 0}
            // All slides share the initial viewport — eager-load the rest so
            // crossfades don't reveal blank space while a photo decodes.
            loading={i === 0 ? undefined : "eager"}
            className="object-cover animate-kenburns"
            unoptimized
          />
        </div>
      ))}

      {/* Bottom-anchored gradient for text legibility — heavier at the bottom
          where the headline sits, fading to transparent above. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

      {/* Overlay text — left-aligned, anchored to bottom-left of the hero. */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-16 sm:pb-24 lg:pb-28">
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight max-w-3xl">
          The wildest luxury homes
          <br />
          <span className="text-accent">on the internet.</span>
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg text-white/80 max-w-2xl">
          Curated mega-mansions, architectural icons, and estates you won't find on Zillow. Seen
          by millions on Instagram — now with direct lines to the agents.
        </p>
        <div className="mt-7 sm:mt-8 flex flex-wrap gap-3">
          <Link
            href="/listings"
            className="bg-white text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
          >
            Browse listings
          </Link>
          <Link
            href="/newsletter"
            className="border border-white/80 text-white px-6 py-3 text-sm uppercase tracking-widest hover:bg-white hover:text-ink transition-colors"
          >
            Get the newsletter
          </Link>
        </div>
      </div>

      {/* Dots + pause/play, bottom-right. Hidden when there's only one photo. */}
      {photos.length > 1 && (
        <div className="absolute bottom-5 right-5 sm:bottom-7 sm:right-7 z-20 flex items-center gap-3">
          <div className="flex gap-2">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === safeIdx}
                className={
                  "w-2.5 h-2.5 rounded-full transition-colors " +
                  (i === safeIdx ? "bg-white" : "bg-white/40 hover:bg-white/70")
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play slideshow" : "Pause slideshow"}
            className="ml-1 text-white/70 hover:text-white p-1"
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </div>
      )}
    </section>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
