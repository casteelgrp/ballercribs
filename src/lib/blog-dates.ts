/**
 * Date helpers for the blog surface. Lives in src/lib so both server-
 * rendered pages (BlogCard, /blog/[slug]) and any future client-side
 * blog teaser cards share one source of truth — formatPublishedAt was
 * previously copy-pasted across two components, fixed here.
 *
 * Rendering rule: when last_updated_at is set AND > 24 hours after
 * published_at, the post displays "Updated <date>" using the refresh
 * timestamp. Otherwise the original publish date stands alone, no
 * prefix. The 24-hour gate prevents day-of typo fixes from flagging
 * the post as freshly updated to readers + crawlers.
 *
 * Same threshold used by the JSON-LD dateModified emission and the
 * sitemap <lastmod> mapping — single rule across all three surfaces.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type DisplayDate = {
  /** "Updated" prefix when refresh is meaningful, null otherwise. */
  label: "Updated" | null;
  /** The Date to render — either lastUpdatedAt or publishedAt. */
  date: Date;
};

/**
 * Pick which date to show on a blog card / detail byline. Returns the
 * publish date when the post hasn't been refreshed (or only trivially
 * within the same day); otherwise returns the refresh date with an
 * "Updated" label so callers can prepend it.
 *
 * Both inputs may be null in draft state — the function falls through
 * to whichever is non-null, defaulting to publish date when both are
 * present. Callers that don't render dates for unpublished posts should
 * gate on publishedAt themselves; this helper only formats.
 */
export function getDisplayDate(post: {
  publishedAt: Date | null;
  lastUpdatedAt: Date | null;
}): DisplayDate | null {
  if (!post.publishedAt) {
    // Draft / unpublished: nothing meaningful to show, return null so
    // callers can choose whether to render anything at all.
    return post.lastUpdatedAt
      ? { label: "Updated", date: post.lastUpdatedAt }
      : null;
  }
  if (
    post.lastUpdatedAt &&
    post.lastUpdatedAt.getTime() - post.publishedAt.getTime() > DAY_MS
  ) {
    return { label: "Updated", date: post.lastUpdatedAt };
  }
  return { label: null, date: post.publishedAt };
}

/**
 * UTC-based "MMM D, YYYY" formatter. Components are taken from the
 * ISO string so the rendered stamp doesn't drift across viewer
 * timezones — same approach the previous local helpers used in
 * BlogCard / blog detail page.
 */
export function formatBlogDate(d: Date): string {
  const iso = d.toISOString();
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[m - 1]} ${day}, ${y}`;
}

/**
 * Convenience wrapper used by every byline render: returns the final
 * display string ("Updated Apr 25, 2026" or "Apr 25, 2026") or empty
 * when neither timestamp is set. Centralised so the prefix spacing
 * stays consistent across surfaces.
 */
export function formatDisplayDate(post: {
  publishedAt: Date | null;
  lastUpdatedAt: Date | null;
}): string {
  const dd = getDisplayDate(post);
  if (!dd) return "";
  const formatted = formatBlogDate(dd.date);
  return dd.label ? `${dd.label} ${formatted}` : formatted;
}
