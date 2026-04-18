"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "./ImageUpload";
import { GalleryEditor } from "./GalleryEditor";
import { generateSlug, validateSlug } from "@/lib/format";
import type { GalleryItem, Listing, ListingStatus, User } from "@/lib/types";

type Props = {
  /** Current logged-in user — drives which status actions are available. */
  currentUser: User;
  /** When provided, the form starts in edit mode (PATCH endpoint). Otherwise it creates. */
  existing?: Listing;
  /** Render all fields disabled, hide save buttons. */
  readOnly?: boolean;
};

export function ListingForm({ currentUser, existing, readOnly = false }: Props) {
  const router = useRouter();
  const isOwner = currentUser.role === "owner";

  // ───── Identity / status state ─────────────────────────────────────────
  // currentListingId is null until either we open in edit mode (existing) OR
  // we save a new listing and capture its id from the create response. Once
  // set, every subsequent save uses PATCH — fixes the bug where Save Draft
  // followed by Submit for Review was POSTing twice and hitting unique-slug.
  const [currentListingId, setCurrentListingId] = useState<number | null>(existing?.id ?? null);
  const [currentStatus, setCurrentStatus] = useState<ListingStatus | null>(
    existing?.status ?? null
  );
  const [currentSlug, setCurrentSlug] = useState<string | null>(existing?.slug ?? null);

  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard against double-click — useState updates aren't visible
  // to a second click that fires before the first re-render.
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Prominent "Saved" banner at the top of the form. Distinct from the
  // small inline timestamp next to the buttons. Auto-fades after 6s; ref
  // tracks the timeout so consecutive saves don't stack timers.
  const [savedNotice, setSavedNotice] = useState<{ kind: "first" | "update" } | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved(kind: "first" | "update") {
    setSavedNotice({ kind });
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedNotice(null), 6000);
  }

  // ───── Form fields ─────────────────────────────────────────────────────
  const [title, setTitle] = useState(existing?.title ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");

  // Slug auto-gen: debounced from title+location while still in "auto" mode.
  // Once the user types anything in the slug input directly, ownership transfers
  // and we stop overwriting their value. Existing listings start owned (the user
  // already has a slug; we don't want to re-derive it from a title edit).
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(existing?.slug));
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (!title.trim() && !location.trim()) return;
    const timer = setTimeout(() => {
      setSlug(generateSlug(title, location));
    }, 300);
    return () => clearTimeout(timer);
  }, [title, location, slugManuallyEdited]);

  const slugError = slug.trim() ? validateSlug(slug.trim()) : null;
  const siteHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ballercribs.vercel.app")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const [priceUsd, setPriceUsd] = useState<string>(existing ? String(existing.price_usd) : "");
  const [bedrooms, setBedrooms] = useState<string>(
    existing?.bedrooms !== null && existing?.bedrooms !== undefined ? String(existing.bedrooms) : ""
  );
  const [bathrooms, setBathrooms] = useState<string>(
    existing?.bathrooms !== null && existing?.bathrooms !== undefined
      ? String(existing.bathrooms)
      : ""
  );
  const [squareFeet, setSquareFeet] = useState<string>(
    existing?.square_feet !== null && existing?.square_feet !== undefined
      ? String(existing.square_feet)
      : ""
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [heroUrl, setHeroUrl] = useState(existing?.hero_image_url ?? "");
  const [gallery, setGallery] = useState<GalleryItem[]>(existing?.gallery_image_urls ?? []);
  const [socialCoverUrl, setSocialCoverUrl] = useState<string | null>(
    existing?.social_cover_url ?? null
  );
  const [agentName, setAgentName] = useState(existing?.agent_name ?? "");
  const [agentBrokerage, setAgentBrokerage] = useState(existing?.agent_brokerage ?? "");
  const [featured, setFeatured] = useState(existing?.featured ?? false);

  function commonFields() {
    return {
      title: title.trim(),
      slug: slug.trim() || null,
      location: location.trim(),
      price_usd: Number(priceUsd),
      bedrooms: bedrooms === "" ? null : Number(bedrooms),
      bathrooms: bathrooms === "" ? null : Number(bathrooms),
      square_feet: squareFeet === "" ? null : Number(squareFeet),
      description: description.trim(),
      hero_image_url: heroUrl.trim(),
      gallery_image_urls: gallery,
      social_cover_url: socialCoverUrl,
      agent_name: agentName.trim() || null,
      agent_brokerage: agentBrokerage.trim() || null,
      featured
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "Title is required.";
    if (!location.trim()) return "Location is required.";
    if (!description.trim()) return "Description is required.";
    if (!heroUrl.trim()) return "Hero image is required.";
    const p = Number(priceUsd);
    if (!Number.isFinite(p) || p < 0) return "Valid price is required.";
    // Server will auto-generate from title+location if slug is empty, so we
    // only need to block when an explicit value is invalid.
    if (slug.trim() && validateSlug(slug.trim())) {
      return "Slug is invalid — see the field below the title.";
    }
    return null;
  }

  /**
   * Single save entry-point. `transitionTo` controls whether we change status:
   *   - undefined  → save fields only, stay on form (Save Draft, Save Changes)
   *   - "review"   → submit for review and redirect
   *   - "published"→ publish now (owner) and redirect
   * Routes to POST (create) when no listing id yet, otherwise PATCH (update).
   */
  async function save(transitionTo?: "review" | "published") {
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
      // ── CREATE path ─────────────────────────────────────────────────
      if (currentListingId === null) {
        // For a brand-new listing, status sent inline = final desired status
        // (no separate transition step needed since it's a single INSERT).
        const desiredStatus: ListingStatus = transitionTo ?? "draft";
        const res = await fetch("/api/listings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...commonFields(), status: desiredStatus })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create listing.");
        }
        const data: { id: number; slug: string; status: ListingStatus } = await res.json();
        setCurrentListingId(data.id);
        setCurrentStatus(data.status);
        setCurrentSlug(data.slug);
        setLastSavedAt(Date.now());

        if (transitionTo) {
          // Created directly in target status → go to admin with the matching toast.
          const toastKey = transitionTo === "review" ? "submitted" : "published";
          router.push(`/admin?toast=${toastKey}`);
          router.refresh();
          return;
        }
        // Save Draft (no transition): stay on /admin so router.refresh updates
        // the listings list below. Skipping the history.replaceState dance —
        // it was confusing the router refresh and the listings list wasn't
        // updating. Tradeoff: a browser reload now goes back to the empty
        // creation form, but the draft is safely in the Draft tab to find.
        flashSaved("first");
        router.refresh();
        return;
      }

      // ── UPDATE path ─────────────────────────────────────────────────
      const res = await fetch(`/api/admin/listings/${currentListingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_fields",
          fields: commonFields(),
          transition_to: transitionTo ?? null
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save listing.");
      }
      const data: { listing?: Listing } = await res.json();
      if (data.listing) {
        setCurrentStatus(data.listing.status);
        setCurrentSlug(data.listing.slug);
      }
      setLastSavedAt(Date.now());

      if (transitionTo) {
        const toastKey = transitionTo === "review" ? "submitted" : "published";
        router.push(`/admin?toast=${toastKey}`);
        router.refresh();
      } else {
        // Subsequent save without transition — show the in-page banner and
        // refresh the listings list so any field changes (e.g. title edits)
        // reflect in the row below.
        flashSaved("update");
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
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-black/5 disabled:text-black/60 disabled:cursor-not-allowed";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";
  const disabled = readOnly;

  // What the primary save button says, based on current state.
  const isPersisted = currentListingId !== null;
  const status = currentStatus;
  const saveLabel = !isPersisted
    ? "Save as draft"
    : status === "draft"
      ? "Save draft"
      : "Save changes";
  // Submit-for-review only makes sense from draft (or unsaved new listing).
  const showSubmitForReview = !isPersisted || status === "draft";
  // Publish-now only for owners and only from draft (or unsaved).
  const showPublishNow = isOwner && (!isPersisted || status === "draft");

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={disabled}
            className={inputClass}
            placeholder="Bel Air Modern Estate"
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
            placeholder="los-angeles-bel-air-fortress"
            disabled={disabled}
            aria-invalid={slugError ? true : undefined}
            aria-describedby="slug-help"
          />
          <p id="slug-help" className="mt-1 text-xs text-black/50 break-all">
            {siteHost}/listings/<span className="text-black/80">{slug || "[auto]"}</span>
            {!slugManuallyEdited && !disabled && (
              <span className="ml-2 text-black/40">· auto-updates from title + location</span>
            )}
          </p>
          {slugError && (
            <p className="mt-1 text-xs text-red-600">{slugError.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Location *</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            disabled={disabled}
            className={inputClass}
            placeholder="Bel Air, CA"
          />
        </div>
        <div>
          <label className={labelClass}>Price (USD) *</label>
          <input
            type="number"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            required
            min="0"
            disabled={disabled}
            className={inputClass}
            placeholder="25000000"
          />
        </div>
        <div>
          <label className={labelClass}>Bedrooms</label>
          <input
            type="number"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            min="0"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Bathrooms</label>
          <input
            type="number"
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            min="0"
            step="0.5"
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Square feet</label>
          <input
            type="number"
            value={squareFeet}
            onChange={(e) => setSquareFeet(e.target.value)}
            min="0"
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        {readOnly ? (
          // Render as the public site does so submitters can verify before approval.
          <div className="border border-black/10 bg-black/[0.02] px-3 py-3 text-sm">
            {description ? (
              description.split("\n\n").map((para, i) => (
                <p key={i} className="text-black/80 leading-relaxed mb-3 last:mb-0 whitespace-pre-line">
                  {para}
                </p>
              ))
            ) : (
              <p className="text-black/40 italic">No description</p>
            )}
          </div>
        ) : (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            disabled={disabled}
            className={inputClass}
            placeholder="Separate paragraphs with blank lines..."
          />
        )}
      </div>

      {readOnly ? (
        <ReadOnlyImage label="Hero image" url={heroUrl} />
      ) : (
        <ImageUpload label="Hero image *" value={heroUrl} onChange={setHeroUrl} />
      )}

      {readOnly ? (
        <ReadOnlyGallery
          gallery={gallery}
          heroUrl={heroUrl}
          socialCoverUrl={socialCoverUrl}
        />
      ) : (
        <GalleryEditor
          label="Gallery"
          gallery={gallery}
          setGallery={setGallery}
          heroUrl={heroUrl}
          onHeroChange={setHeroUrl}
          socialCoverUrl={socialCoverUrl}
          onSocialCoverChange={setSocialCoverUrl}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Agent name</label>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Agent brokerage</label>
          <input
            value={agentBrokerage}
            onChange={(e) => setAgentBrokerage(e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>

      <label
        className={
          "flex items-center gap-2 text-sm " +
          (disabled ? "text-black/40 cursor-not-allowed" : "cursor-pointer")
        }
      >
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          disabled={disabled}
          className="accent-accent"
        />
        <span>Featured</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => save()}
            className={
              "px-6 py-3 text-sm uppercase tracking-widest disabled:opacity-50 transition-colors " +
              (status === "draft" || !isPersisted
                ? "border border-black/30 hover:border-accent hover:text-accent"
                : "bg-ink text-paper hover:bg-accent")
            }
          >
            {submitting ? "Saving…" : saveLabel}
          </button>
          {showSubmitForReview && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => save("review")}
              className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
            >
              Submit for review
            </button>
          )}
          {showPublishNow && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => save("published")}
              className="bg-accent text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
            >
              Publish now
            </button>
          )}
          {lastSavedAt && (
            <span className="text-xs text-black/50">
              Saved at {new Date(lastSavedAt).toLocaleTimeString()}
              {currentSlug && isPersisted && status === "draft" && (
                <> · slug: <code className="font-mono">{currentSlug}</code></>
              )}
            </span>
          )}
        </div>
      )}

      {/* Saved confirmation lives here (right under the buttons) so the user
          sees feedback without scrolling, and the listings list below picks
          up the new draft via router.refresh(). */}
      {savedNotice && !readOnly && (
        <div
          role="status"
          aria-live="polite"
          className="border border-green-300 bg-green-50 text-green-900 px-4 py-3 flex items-center justify-between gap-4"
        >
          <span className="text-sm">
            {savedNotice.kind === "first" ? (
              <>
                <strong>Draft saved.</strong> Look for it in the listings table below
                — or jump to your{" "}
                <a
                  href="/admin?status=draft"
                  className="underline underline-offset-2 hover:text-green-700"
                >
                  Draft tab
                </a>
                .
              </>
            ) : (
              <>
                <strong>Saved.</strong> Changes are live on this {status ?? "listing"}.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            aria-label="Dismiss"
            className="text-green-900/70 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}
    </form>
  );
}

// Lightweight read-only renderers — avoid loading the upload SDK / dnd-kit when we don't need them.

function ReadOnlyImage({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">{label}</label>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="max-w-md aspect-[4/3] object-cover border border-black/10 bg-black/5"
        />
      ) : (
        <p className="text-sm text-black/40">No image</p>
      )}
    </div>
  );
}

function ReadOnlyGallery({
  gallery,
  heroUrl,
  socialCoverUrl
}: {
  gallery: GalleryItem[];
  heroUrl: string;
  socialCoverUrl: string | null;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-black/60 mb-2">Gallery</label>
      {gallery.length === 0 ? (
        <p className="text-sm text-black/40">No gallery images</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {gallery.map((item) => (
            <figure key={item.url} className="border border-black/10 bg-white">
              <div className="relative aspect-square overflow-hidden bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.caption ?? ""} className="w-full h-full object-cover" />
                {item.url === heroUrl && (
                  <span className="absolute top-1 left-1 text-[10px] uppercase tracking-widest bg-accent text-ink px-1.5 py-0.5">
                    Hero
                  </span>
                )}
                {item.url === socialCoverUrl && (
                  <span className="absolute top-1 right-1 text-[10px] uppercase tracking-widest bg-accent text-ink px-1.5 py-0.5">
                    Social
                  </span>
                )}
              </div>
              {item.caption && (
                <figcaption className="px-2 py-1.5 text-xs text-black/60 border-t border-black/10 whitespace-pre-line">
                  {item.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
