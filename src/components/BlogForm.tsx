"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generateBlogSlug, validateSlug } from "@/lib/format";
import { ImageUpload } from "./ImageUpload";
import { BlogEditor } from "./BlogEditor";
import { isOwner } from "@/lib/permissions";
import type { BlogPost, PostCategory, PostStatus } from "@/types/blog";
import type { User } from "@/lib/types";

type Props = {
  currentUser: User;
  categories: PostCategory[];
  /** When provided, the form opens in edit mode (PATCH). Absent → create (POST). */
  existing?: BlogPost;
};

// Title/description character thresholds match the listings SEO overrides
// pattern so the two surfaces feel consistent.
const TITLE_SAFE = 60;
const TITLE_WARN = 70;
const DESC_SAFE = 155;
const DESC_WARN = 170;

function counterTone(len: number, safe: number, warn: number): string {
  if (len === 0 || len <= safe) return "text-black/50";
  if (len <= warn) return "text-amber-700";
  return "text-red-600";
}

/**
 * Render a UTC Date as the literal value an <input type="datetime-local">
 * expects ("YYYY-MM-DDTHH:MM"). Browsers display the field in the
 * viewer's local TZ; we feed it back the date the row was actually
 * stamped, in local time, so the input doesn't drift on display.
 */
function dateToLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function BlogForm({ currentUser, categories, existing }: Props) {
  const router = useRouter();
  const owner = isOwner(currentUser);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(existing?.slug));
  const [categorySlug, setCategorySlug] = useState(
    existing?.categorySlug ?? categories[0]?.slug ?? "guides"
  );
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(existing?.coverImageUrl ?? "");
  const [coverImageAlt, setCoverImageAlt] = useState(existing?.coverImageAlt ?? "");
  const [socialCoverUrl, setSocialCoverUrl] = useState(existing?.socialCoverUrl ?? "");
  const [isFeatured, setIsFeatured] = useState(Boolean(existing?.isFeatured));
  const [metaTitle, setMetaTitle] = useState(existing?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(existing?.metaDescription ?? "");
  // Stored as the literal value of <input type="datetime-local"> —
  // "YYYY-MM-DDTHH:MM" in the viewer's local TZ. Converted to a UTC
  // ISO string for the API payload on save. Empty string = clear it.
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(
    existing?.lastUpdatedAt ? dateToLocalInput(existing.lastUpdatedAt) : ""
  );

  // Body state — seeded from existing bodyJson and updated on every
  // editor tick. bodyHtml is regenerated alongside so we can ship both.
  const [bodyJson, setBodyJson] = useState<unknown | null>(existing?.bodyJson ?? null);
  const [bodyHtml, setBodyHtml] = useState<string>(existing?.bodyHtml ?? "");

  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Slug auto-derives from title until the author types into the slug
  // field directly, matching the listings form behaviour.
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (!title.trim()) return;
    const t = setTimeout(() => setSlug(generateBlogSlug(title)), 250);
    return () => clearTimeout(t);
  }, [title, slugManuallyEdited]);

  const slugErr = slug.trim() ? validateSlug(slug.trim()) : null;
  const currentStatus: PostStatus | null = existing?.status ?? null;
  const isPersisted = Boolean(existing);

  function validate(): string | null {
    if (!title.trim()) return "Title is required.";
    if (!categorySlug) return "Category is required.";
    if (!bodyJson || !bodyHtml.trim()) return "Body content is required.";
    if (slug.trim() && validateSlug(slug.trim())) {
      return "Slug is invalid — see the field below the title.";
    }
    return null;
  }

  function payload() {
    return {
      title: title.trim(),
      slug: slug.trim() || undefined,
      subtitle: subtitle.trim() || null,
      excerpt: excerpt.trim() || null,
      bodyJson,
      bodyHtml,
      coverImageUrl: coverImageUrl.trim() || null,
      coverImageAlt: coverImageAlt.trim() || null,
      socialCoverUrl: socialCoverUrl.trim() || null,
      metaTitle: metaTitle.trim() || null,
      metaDescription: metaDescription.trim() || null,
      categorySlug,
      isFeatured,
      // datetime-local input gives us a naive local-TZ string; new
      // Date(string).toISOString() interprets it as local time and
      // returns UTC, which is exactly what the DB column expects.
      // Empty string = clear (server preserves on undefined; explicit
      // null replaces). Send null when blank so authors can unset.
      lastUpdatedAt: lastUpdatedAt
        ? new Date(lastUpdatedAt).toISOString()
        : null
    };
  }

  async function save(transitionTo?: "submit" | "publish") {
    if (inFlightRef.current) return;
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    inFlightRef.current = true;
    setSubmitting(true);
    try {
      let postId = existing?.id;

      if (!isPersisted) {
        const res = await fetch("/api/admin/blog/posts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload())
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create post.");
        }
        const data = (await res.json()) as { post: BlogPost };
        postId = data.post.id;
      } else {
        const res = await fetch(`/api/admin/blog/posts/${postId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload())
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update post.");
        }
      }

      if (transitionTo && postId) {
        const path =
          transitionTo === "submit"
            ? `/api/admin/blog/posts/${postId}/submit`
            : `/api/admin/blog/posts/${postId}/publish`;
        const res = await fetch(path, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to ${transitionTo}.`);
        }
      }

      setSavedAt(Date.now());
      if (transitionTo) {
        // Transitions land the user on the list view — scrolling to top
        // is expected here (different surface entirely).
        router.push("/admin/blog");
        router.refresh();
      } else if (!isPersisted && postId) {
        // First-save of a brand-new post — jump into edit mode so further
        // saves PATCH the existing row instead of POSTing a second one.
        // scroll:false keeps the author's position in the editor since
        // the content is visually identical after the URL change.
        router.push(`/admin/blog/${postId}/edit`, { scroll: false });
        router.refresh();
      } else {
        // No transition on an existing post — refresh re-fetches the
        // server component without navigating, so scroll is preserved
        // for free.
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-black/5";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  const showSubmitForReview = !isPersisted || currentStatus === "draft";
  const showPublish = owner && (!isPersisted || currentStatus === "draft" || currentStatus === "review");

  // Shared label so the top and bottom save buttons read consistently
  // as state changes. "Save as draft" on a brand-new post, "Save draft"
  // on an existing draft, "Save changes" once the post is past draft.
  const saveLabel = submitting
    ? "Saving…"
    : isPersisted
      ? currentStatus === "draft"
        ? "Save draft"
        : "Save changes"
      : "Save as draft";

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {/* Top save button — non-sticky, right-aligned. Handles save-access
          at the top of a long form so the author doesn't have to scroll
          to the bottom after a minor edit. Shares save() + submitting
          state with the bottom buttons, so clicking either disables
          both and shows the same label. */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={() => save()}
          className="bg-ink text-paper px-6 py-2.5 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveLabel}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputClass}
            placeholder="Why the Hamptons Rental Market Is Insane This Year"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className={inputClass}
            placeholder="Optional deck line"
          />
        </div>
        <div>
          <label className={labelClass}>Slug</label>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            className={inputClass}
            placeholder="hamptons-rental-market-2026"
            aria-invalid={slugErr ? true : undefined}
          />
          <p className="mt-1 text-xs text-black/50">
            /blog/<span className="text-black/80">{slug || "[auto]"}</span>
            {!slugManuallyEdited && (
              <span className="ml-2 text-black/40">· auto-updates from title</span>
            )}
          </p>
          {slugErr && <p className="mt-1 text-xs text-red-600">{slugErr.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Category *</label>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            required
            className={inputClass + " pr-8"}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Excerpt</label>
          <textarea
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={240}
            className={inputClass}
            placeholder="One or two sentences. Lands on index cards and as the SEO description fallback."
          />
          <div className="flex justify-end">
            <span className={"text-xs tabular-nums " + counterTone(excerpt.length, 200, 240)}>
              {excerpt.length} / 200
            </span>
          </div>
        </div>
      </div>

      <ImageUpload label="Cover image" value={coverImageUrl} onChange={setCoverImageUrl} />

      {/* Cover alt — accessibility text + og:image:alt + JSON-LD
          ImageObject.description. Distinct from the post title: should
          describe what's IN the image, not restate the headline. Falls
          back to title on render when blank, so leaving this empty is
          the same shape existing posts had pre-018 — but worth filling
          in for the audience that needs it. */}
      <div>
        <label className={labelClass} htmlFor="cover-alt">
          Cover image alt text
        </label>
        <input
          id="cover-alt"
          type="text"
          value={coverImageAlt}
          onChange={(e) => setCoverImageAlt(e.target.value)}
          placeholder="Aerial view of Beverly Park estate at dusk"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-black/50">
          Describes the image for screen readers, social shares, and image
          search. Don&apos;t restate the title — describe what&apos;s in the
          photo. Falls back to the post title if left empty.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="accent-accent"
          />
          <span>Featured post</span>
        </label>
        {isFeatured && !existing?.isFeatured && (
          <p className="mt-1 text-xs text-amber-700">
            Saving will unfeature any other post currently marked featured.
          </p>
        )}
      </div>

      {/* Editorial refresh timestamp. Distinct from the row's auto-
          bumped updated_at — set this only when the post itself
          materially changes (refreshed prices, new listings on a
          roundup, market shifts). Drives the public "Updated <date>"
          byline + JSON-LD dateModified + sitemap <lastmod>. */}
      <div>
        <label className={labelClass} htmlFor="last-updated-at">
          Last updated
        </label>
        <div className="flex items-center gap-2">
          <input
            id="last-updated-at"
            type="datetime-local"
            value={lastUpdatedAt}
            onChange={(e) => setLastUpdatedAt(e.target.value)}
            className={inputClass + " max-w-xs"}
          />
          <button
            type="button"
            onClick={() => setLastUpdatedAt(dateToLocalInput(new Date()))}
            className="text-xs uppercase tracking-widest border border-black/20 px-3 py-2 hover:border-black/50 transition-colors"
          >
            Set to now
          </button>
          {lastUpdatedAt && (
            <button
              type="button"
              onClick={() => setLastUpdatedAt("")}
              className="text-xs text-black/50 hover:text-red-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-black/50">
          Set when you refresh a post (new prices, swapped properties,
          market changes). Leave blank otherwise — typo fixes and minor
          edits don&apos;t count.
        </p>
      </div>

      <div>
        <label className={labelClass}>Body *</label>
        <BlogEditor
          initialContent={bodyJson}
          onChange={(json, html) => {
            setBodyJson(json);
            setBodyHtml(html);
          }}
        />
      </div>

      <details className="border border-black/10 bg-black/[0.02]" open={Boolean(metaTitle || metaDescription || socialCoverUrl)}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm flex items-center justify-between hover:bg-black/5">
          <span className="uppercase tracking-widest text-xs text-black/70">SEO &amp; social overrides</span>
          <span className="text-[11px] text-black/50 normal-case tracking-normal">
            {metaTitle || metaDescription || socialCoverUrl ? "Custom" : "Optional"}
          </span>
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-black/10">
          <div>
            <label className={labelClass}>Meta title</label>
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className={inputClass}
              placeholder="Leave blank to use the post title"
            />
            <div className="flex justify-end">
              <span className={"text-xs tabular-nums " + counterTone(metaTitle.length, TITLE_SAFE, TITLE_WARN)}>
                {metaTitle.length} / {TITLE_SAFE}
              </span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Meta description</label>
            <textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className={inputClass}
              placeholder="Leave blank to auto-generate from excerpt"
            />
            <div className="flex justify-end">
              <span className={"text-xs tabular-nums " + counterTone(metaDescription.length, DESC_SAFE, DESC_WARN)}>
                {metaDescription.length} / {DESC_SAFE}
              </span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Social cover URL override</label>
            <input
              value={socialCoverUrl}
              onChange={(e) => setSocialCoverUrl(e.target.value)}
              className={inputClass}
              placeholder="https://…/social-1200x630.webp — falls back to cover image"
            />
          </div>
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => save()}
          className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {saveLabel}
        </button>
        {showSubmitForReview && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => save("submit")}
            className="border border-ink text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
          >
            Submit for review
          </button>
        )}
        {showPublish && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => save("publish")}
            className="bg-accent text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
          >
            Publish
          </button>
        )}
        {savedAt && (
          <span className="text-xs text-black/50">
            Saved at {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </form>
  );
}
