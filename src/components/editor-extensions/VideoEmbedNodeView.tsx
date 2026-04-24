"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { VideoEmbedAttrs } from "./VideoEmbed";

/**
 * Compact editor-surface preview of a video embed — thumbnail + play
 * icon + provider label. Not a live iframe: embed iframes are costly
 * and can autoplay / consent-prompt on mount. The public page is where
 * the real player lives; the editor just previews.
 *
 * YouTube thumbnails come straight from i.ytimg.com (no API key).
 * Vimeo doesn't expose a direct thumb URL pattern, so we fetch the
 * public oEmbed endpoint on mount and pull thumbnail_url from it.
 * Fetch failure is non-fatal — the placeholder renders instead.
 */
export function VideoEmbedNodeView(props: NodeViewProps) {
  const attrs = props.node.attrs as VideoEmbedAttrs & {
    startAt: number | null;
    vimeoHash: string | null;
  };
  const [vimeoThumb, setVimeoThumb] = useState<string | null>(null);

  useEffect(() => {
    if (attrs.provider !== "vimeo" || !attrs.videoId) return;
    let cancelled = false;
    // Public oEmbed endpoint — no auth. Hash passed through when
    // present so unlisted videos still resolve.
    const vimeoUrl = attrs.vimeoHash
      ? `https://vimeo.com/${attrs.videoId}/${attrs.vimeoHash}`
      : `https://vimeo.com/${attrs.videoId}`;
    fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { thumbnail_url?: string } | null) => {
        if (cancelled) return;
        if (data?.thumbnail_url) setVimeoThumb(data.thumbnail_url);
      })
      .catch(() => {
        /* silent — placeholder stands in */
      });
    return () => {
      cancelled = true;
    };
  }, [attrs.provider, attrs.videoId, attrs.vimeoHash]);

  function requestEdit() {
    const cb = props.editor.storage.videoEmbed?.onEditRequest as
      | undefined
      | ((pos: number, attrs: VideoEmbedAttrs) => void);
    if (!cb) return;
    const pos = typeof props.getPos === "function" ? props.getPos() : null;
    if (pos === null || pos === undefined) return;
    cb(pos, {
      provider: attrs.provider,
      videoId: attrs.videoId,
      url: attrs.url,
      startAt: attrs.startAt ?? undefined,
      vimeoHash: attrs.vimeoHash ?? undefined
    });
  }

  function remove() {
    if (typeof props.getPos !== "function") return;
    const pos = props.getPos();
    if (pos === null || pos === undefined) return;
    const { view } = props.editor;
    const tr = view.state.tr.delete(pos, pos + props.node.nodeSize);
    view.dispatch(tr);
  }

  // Thumbnail source — YouTube goes direct to i.ytimg.com's hqdefault
  // (widely-cached, no API). Vimeo fills in from oEmbed if/when it
  // arrives. Either way, a graceful placeholder covers the gap.
  const thumbUrl =
    attrs.provider === "youtube"
      ? `https://i.ytimg.com/vi/${attrs.videoId}/hqdefault.jpg`
      : vimeoThumb;

  const providerLabel = attrs.provider === "youtube" ? "YouTube" : "Vimeo";

  return (
    <NodeViewWrapper
      data-video-embed-preview="true"
      className="my-6 border border-black/10 bg-black/[0.02] group relative p-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-accent">
          Video
        </span>
        <span className="text-xs text-black/60">{providerLabel}</span>
        {attrs.startAt && attrs.startAt > 0 && (
          <span className="text-[10px] text-black/45">
            starts at {formatStartAt(attrs.startAt)}
          </span>
        )}
      </div>

      <div className="relative w-full max-w-md aspect-video bg-black/80 border border-black/10 overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={`${providerLabel} video thumbnail`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-white/50">
            {providerLabel} · {attrs.videoId}
          </div>
        )}
        {/* Play-icon overlay — decorative, signals "this is a video". */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-white ml-1"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div
        className="absolute top-2 right-2 flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
        contentEditable={false}
      >
        <button
          type="button"
          onClick={requestEdit}
          className="text-[10px] uppercase tracking-widest bg-ink text-paper px-2 py-1 hover:bg-accent hover:text-ink transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={remove}
          className="text-[10px] uppercase tracking-widest bg-white border border-black/20 px-2 py-1 hover:border-red-500 hover:text-red-600 transition-colors"
        >
          Remove
        </button>
      </div>
    </NodeViewWrapper>
  );
}

function formatStartAt(seconds: number): string {
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
