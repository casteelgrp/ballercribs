"use client";

import { useState } from "react";

/**
 * A 'Recent features' tile. Tries to load /{src}; if the file 404s or any
 * load error, renders a dark 'Coming soon' placeholder so the page doesn't
 * show a broken image icon while Jay uploads the real screenshots.
 */
export function FeatureTile({
  src,
  caption,
  stats
}: {
  src: string;
  caption: string;
  stats: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <figure className="space-y-3">
      <div className="relative aspect-square bg-ink overflow-hidden">
        {loadFailed ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs uppercase tracking-widest text-paper/50">Coming soon</span>
          </div>
        ) : (
          // Plain <img> — we need the onError hook, and these screenshots come
          // from /public so next/image optimisation isn't worth the friction.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={caption}
            onError={() => setLoadFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
      <figcaption>
        {/* Title is the context; stats are the persuader. Flip the typographic
            hierarchy so the numbers hit the eye first: regular-weight muted
            title above a bolder, smaller, ink-coloured stats line. */}
        <p className="text-base font-normal text-black/70">{caption}</p>
        <p className="text-sm font-semibold text-ink mt-1">{stats}</p>
      </figcaption>
    </figure>
  );
}
