"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";
import type { Destination, DestinationCounts } from "@/lib/types";

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLURB_SOFT_CAP = 280;

/**
 * Shared form for /admin/destinations/new and /admin/destinations/[id]/edit.
 * `existing` is null on create; the form posts to /api/admin/destinations.
 * Edit posts a PATCH to /api/admin/destinations/{id}.
 *
 * Slug auto-fill: on blur of the Name field, if Slug is still empty,
 * we kebab-case the name into the Slug input. Doesn't follow Name
 * changes after that — once Slug is set, it stays put unless the
 * admin edits it manually. Matches the partner form's "no continuous
 * follow-along" pattern.
 *
 * Delete (edit mode only): pre-confirm shows the live attached counts
 * so admins know how many listings/rentals/stories are about to be
 * untagged. The DB FKs are ON DELETE SET NULL so this is informational
 * — content stays, just loses its destination pointer.
 */
export function DestinationForm({
  existing,
  attachedCounts
}: {
  existing: Destination | null;
  /** Counts of attached content. Edit-only — null on create. */
  attachedCounts?: DestinationCounts;
}) {
  const router = useRouter();
  const isEdit = Boolean(existing);

  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [region, setRegion] = useState(existing?.region ?? "");
  const [blurb, setBlurb] = useState(existing?.blurb ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(existing?.hero_image_url ?? "");
  const [heroImageAlt, setHeroImageAlt] = useState(existing?.hero_image_alt ?? "");
  const [seoTitle, setSeoTitle] = useState(existing?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(existing?.seo_description ?? "");
  const [published, setPublished] = useState(existing?.published ?? false);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const slugErr = useMemo(() => {
    const s = slug.trim();
    if (!s) return null;
    if (!SLUG_RX.test(s)) return "Use lowercase letters, numbers, and hyphens only.";
    return null;
  }, [slug]);

  const blurbLen = blurb.length;
  const blurbOver = blurbLen > BLURB_SOFT_CAP;

  // Live previews of the SEO fallbacks so admins can see what will
  // actually render if they leave the override fields blank. Mirrors
  // the public detail page's metadata logic — keep these two in sync.
  const seoTitleFallback = name.trim()
    ? `${name.trim()} — Luxury Homes & Rentals | BallerCribs`
    : "{Name} — Luxury Homes & Rentals | BallerCribs";
  const seoDescriptionFallback = (() => {
    const trimmedBlurb = blurb.trim();
    if (trimmedBlurb) {
      return trimmedBlurb.length > 160
        ? trimmedBlurb.slice(0, 157).trimEnd() + "…"
        : trimmedBlurb;
    }
    const dn = displayName.trim() || "{Display name}";
    return `Curated luxury listings and rentals in ${dn}. Mansions, estates, and architectural icons from BallerCribs.`;
  })();

  /** Kebab-case a name on blur if the slug input is still empty. */
  function handleNameBlur() {
    if (slug.trim()) return;
    const generated = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (generated) setSlug(generated);
  }

  function validate(): string | null {
    if (!name.trim()) return "Name is required.";
    if (!slug.trim()) return "Slug is required.";
    if (slugErr) return slugErr;
    if (!displayName.trim()) return "Display name is required.";
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setError("");
    setSubmitting(true);

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      display_name: displayName.trim(),
      region: region.trim() || null,
      blurb: blurb.trim() || null,
      hero_image_url: heroImageUrl.trim() || null,
      hero_image_alt: heroImageAlt.trim() || null,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      published
    };

    try {
      const url = isEdit
        ? `/api/admin/destinations/${existing!.id}`
        : "/api/admin/destinations";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed.");
      }
      router.push("/admin/destinations");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !existing) return;
    const c = attachedCounts ?? { listings: 0, rentals: 0, blog_posts: 0 };
    const total = c.listings + c.rentals + c.blog_posts;
    const message =
      total > 0
        ? `${c.listings} listing${c.listings === 1 ? "" : "s"}, ${c.rentals} rental${c.rentals === 1 ? "" : "s"}, ${c.blog_posts} blog post${c.blog_posts === 1 ? "" : "s"} are tagged to this destination. They will become untagged but not deleted. Continue?`
        : "Delete this destination? Nothing is currently tagged to it.";
    if (!window.confirm(message)) return;

    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/destinations/${existing.id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed.");
      }
      router.push("/admin/destinations");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5 max-w-2xl"
    >
      <div>
        <label className={labelClass} htmlFor="dest-name">
          Name *
        </label>
        <input
          id="dest-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          className={inputClass}
          placeholder="Malibu"
        />
        <p className="mt-1 text-xs text-black/50">
          Short display name. Appears in card headers, chip rows, and section
          headings (&ldquo;Listings in {name.trim() || "Malibu"}&rdquo;).
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="dest-slug">
          Slug *
        </label>
        <input
          id="dest-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={inputClass}
          placeholder="malibu"
          aria-invalid={slugErr ? true : undefined}
        />
        {slugErr && <p className="mt-1 text-xs text-red-600">{slugErr}</p>}
        <p className="mt-1 text-xs text-black/50">
          Lowercase, kebab-case, unique. Auto-filled from Name on blur if
          left empty.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="dest-display-name">
          Display name *
        </label>
        <input
          id="dest-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
          placeholder="Malibu, California"
        />
        <p className="mt-1 text-xs text-black/50">
          Longer phrasing used as the H1 on the public destination page and
          in SEO descriptions.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="dest-region">
          Region
        </label>
        <input
          id="dest-region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className={inputClass}
          placeholder="United States"
        />
        <p className="mt-1 text-xs text-black/50">
          Used to group destinations on the public index page. Examples:
          United States, Europe, Caribbean.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="dest-blurb">
          Blurb
        </label>
        <textarea
          id="dest-blurb"
          rows={3}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          className={inputClass}
          placeholder="One to three sentences introducing the destination. Shown in the hero of the destination page and used as the SEO description fallback."
        />
        <div className="mt-1 flex items-start justify-between gap-2 text-xs">
          <p className="text-black/50">
            Optional. Hero subhead on /destinations/{slug.trim() || "[slug]"}.
          </p>
          <p
            className={
              blurbOver ? "text-amber-700 tabular-nums" : "text-black/50 tabular-nums"
            }
          >
            {blurbLen} / {BLURB_SOFT_CAP}
          </p>
        </div>
      </div>

      <ImageUpload label="Hero image" value={heroImageUrl} onChange={setHeroImageUrl} />
      <p className="-mt-2 text-xs text-black/50">
        Optional. Full-width hero on the destination page. Falls back to a
        muted background if unset.
      </p>

      {heroImageUrl && (
        <div>
          <label className={labelClass} htmlFor="dest-hero-alt">
            Hero image alt text
          </label>
          <input
            id="dest-hero-alt"
            value={heroImageAlt}
            onChange={(e) => setHeroImageAlt(e.target.value)}
            className={inputClass}
            placeholder={`Aerial view of ${displayName.trim() || name.trim() || "Malibu"}`}
          />
          <p className="mt-1 text-xs text-black/50">
            Describe the image for screen readers. Leave blank only if the
            image is purely decorative.
          </p>
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="dest-seo-title">
          SEO title
        </label>
        <input
          id="dest-seo-title"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          className={inputClass}
          placeholder={seoTitleFallback}
          maxLength={120}
        />
        <p className="mt-1 text-xs text-black/50">
          Optional override. Falls back to{" "}
          <span className="text-black/70">{seoTitleFallback}</span>. Aim for
          under 60 characters.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="dest-seo-description">
          SEO description
        </label>
        <textarea
          id="dest-seo-description"
          rows={2}
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          className={inputClass}
          placeholder={seoDescriptionFallback}
          maxLength={300}
        />
        <p className="mt-1 text-xs text-black/50">
          Optional override. Falls back to{" "}
          <span className="text-black/70">{seoDescriptionFallback}</span>{" "}
          Aim for under 160 characters.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="accent-accent"
          />
          <span>Published</span>
        </label>
        <p className="mt-1 text-xs text-black/50">
          Drafts are hidden from the public /destinations index and the
          /destinations/[slug] page returns 404 until published.
        </p>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2 flex-wrap">
        <button
          type="submit"
          disabled={submitting || deleting}
          className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create destination"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/destinations")}
          className="border border-black/20 px-5 py-2 text-sm uppercase tracking-widest hover:border-black/50 transition-colors"
        >
          Cancel
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || submitting}
            className="ml-auto border border-red-300 text-red-700 px-5 py-2 text-sm uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
