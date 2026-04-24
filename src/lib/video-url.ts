/**
 * Shared URL parser + embed builder for the blog Video node.
 *
 * `parseVideoUrl` normalises all supported input shapes into
 * `{ provider, videoId, originalUrl, ?startAt, ?vimeoHash }`. The modal
 * uses it to display the "Detected: …" preview + to reject unsupported
 * URLs; the Video extension uses it to stamp the node attrs on insert
 * + edit. Returns null for anything outside the supported set (no
 * auto-lenient fallbacks — unknown provider = user fixes the URL).
 *
 * `buildEmbedSrc` renders the privacy-enhanced iframe URL from parsed
 * attrs. YouTube always goes to www.youtube-nocookie.com/embed/ with
 * rel=0 so suggested videos stick to the original channel; start time
 * passes through as the YouTube `start` param. Vimeo sends the hash
 * param (`h`) when present so unlisted/private videos stay accessible.
 *
 * Supported inputs:
 *   - youtube.com/watch?v=ID (+ optional &t=Xs / &start=Xs / &t=30)
 *   - m.youtube.com/watch?v=ID
 *   - youtu.be/ID (+ optional ?t=Xs)
 *   - youtube.com/shorts/ID
 *   - youtube.com/embed/ID and youtube-nocookie.com/embed/ID
 *   - vimeo.com/ID
 *   - vimeo.com/ID/HASH (private / unlisted with hash)
 *   - player.vimeo.com/video/ID (?h=HASH optional)
 */

export type VideoProvider = "youtube" | "vimeo";

export type ParsedVideo = {
  provider: VideoProvider;
  videoId: string;
  originalUrl: string;
  /** Seconds into the video to start playback (YouTube only). */
  startAt?: number;
  /** Vimeo unlisted / private hash — required for some Vimeo videos. */
  vimeoHash?: string;
};

/**
 * Parse a YouTube timestamp param. Accepts:
 *   - "30"        → 30
 *   - "30s"       → 30
 *   - "1m30s"     → 90
 *   - "1h20m5s"   → 4805
 * Returns undefined for unparseable input rather than throwing, so a
 * malformed `t=` doesn't block the insert.
 */
function parseYouTubeStartTime(raw: string | null): number | undefined {
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return n > 0 ? n : undefined;
  }
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return undefined;
  const h = parseInt(m[1] ?? "0", 10);
  const mi = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  const total = h * 3600 + mi * 60 + s;
  return total > 0 ? total : undefined;
}

export function parseVideoUrl(input: string): ParsedVideo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  // Normalise host so both `www.youtube.com` and `youtube.com` resolve.
  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  // ─── YouTube ────────────────────────────────────────────────────────
  if (host === "youtube.com" || host === "m.youtube.com") {
    // /watch?v=ID
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (!id) return null;
      const startAt = parseYouTubeStartTime(
        u.searchParams.get("t") ?? u.searchParams.get("start")
      );
      return { provider: "youtube", videoId: id, originalUrl: trimmed, startAt };
    }
    // /shorts/ID — YouTube Shorts
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/shorts/")[1]?.split("/")[0];
      if (!id) return null;
      return { provider: "youtube", videoId: id, originalUrl: trimmed };
    }
    // /embed/ID — already-embedded URL, normalise back
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.split("/embed/")[1]?.split("/")[0];
      if (!id) return null;
      const startAt = parseYouTubeStartTime(u.searchParams.get("start"));
      return { provider: "youtube", videoId: id, originalUrl: trimmed, startAt };
    }
    return null;
  }

  if (host === "youtube-nocookie.com") {
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.split("/embed/")[1]?.split("/")[0];
      if (!id) return null;
      const startAt = parseYouTubeStartTime(u.searchParams.get("start"));
      return { provider: "youtube", videoId: id, originalUrl: trimmed, startAt };
    }
    return null;
  }

  // Short link: youtu.be/ID
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (!id) return null;
    const startAt = parseYouTubeStartTime(u.searchParams.get("t"));
    return { provider: "youtube", videoId: id, originalUrl: trimmed, startAt };
  }

  // ─── Vimeo ──────────────────────────────────────────────────────────
  if (host === "vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const id = parts[0];
    if (!/^\d+$/.test(id)) return null;
    // /{id}/{hash} — private / unlisted shape
    const vimeoHash = parts[1] && /^[a-f0-9]+$/i.test(parts[1]) ? parts[1] : undefined;
    return { provider: "vimeo", videoId: id, originalUrl: trimmed, vimeoHash };
  }

  if (host === "player.vimeo.com") {
    if (u.pathname.startsWith("/video/")) {
      const id = u.pathname.split("/video/")[1]?.split("/")[0];
      if (!id || !/^\d+$/.test(id)) return null;
      const vimeoHash = u.searchParams.get("h") || undefined;
      return { provider: "vimeo", videoId: id, originalUrl: trimmed, vimeoHash };
    }
    return null;
  }

  return null;
}

/**
 * Build the iframe src from parsed attrs. Always privacy-enhanced on
 * YouTube (www.youtube-nocookie.com + rel=0). Vimeo carries the hash
 * param when present for unlisted access.
 */
export function buildEmbedSrc(parsed: {
  provider: VideoProvider;
  videoId: string;
  startAt?: number;
  vimeoHash?: string;
}): string {
  if (parsed.provider === "youtube") {
    const params = new URLSearchParams();
    params.set("rel", "0");
    if (parsed.startAt && parsed.startAt > 0) {
      params.set("start", String(Math.floor(parsed.startAt)));
    }
    return `https://www.youtube-nocookie.com/embed/${parsed.videoId}?${params.toString()}`;
  }
  // Vimeo
  const params = new URLSearchParams();
  if (parsed.vimeoHash) params.set("h", parsed.vimeoHash);
  const q = params.toString();
  return `https://player.vimeo.com/video/${parsed.videoId}${q ? `?${q}` : ""}`;
}

/**
 * Strict allowlist for iframe `src` — only our two privacy-enhanced
 * providers. Called from the sanitizer hook to strip any iframe whose
 * src doesn't match. Separated so unit-testing the rule is trivial.
 */
export function isAllowedEmbedSrc(src: string): boolean {
  if (!src) return false;
  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "www.youtube-nocookie.com" || host === "youtube-nocookie.com") {
    return u.pathname.startsWith("/embed/");
  }
  if (host === "player.vimeo.com") {
    return u.pathname.startsWith("/video/");
  }
  return false;
}
