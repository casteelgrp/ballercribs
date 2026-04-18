"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "./ImageUpload";
import { GalleryEditor } from "./GalleryEditor";
import type { GalleryItem, Listing, ListingStatus, User } from "@/lib/types";

type Props = {
  /** Current logged-in user — drives which status actions are available. */
  currentUser: User;
  /** When provided, the form edits this listing via PATCH. Otherwise it creates one via POST. */
  existing?: Listing;
};

export function ListingForm({ currentUser, existing }: Props) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const isOwner = currentUser.role === "owner";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // Form state
  const [title, setTitle] = useState(existing?.title ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [priceUsd, setPriceUsd] = useState<string>(
    existing ? String(existing.price_usd) : ""
  );
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
    return null;
  }

  async function submitCreate(targetStatus: ListingStatus) {
    setSubmitting(true);
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...commonFields(), status: targetStatus })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create listing.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!existing) return;
    setSubmitting(true);
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/listings/${existing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_fields", fields: commonFields() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update listing.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputClass}
            placeholder="Bel Air Modern Estate"
          />
        </div>
        <div>
          <label className={labelClass}>Slug (optional — auto-generated)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="bel-air-modern-estate"
            disabled={isEdit}
            title={isEdit ? "Slug is fixed after creation" : undefined}
          />
        </div>
        <div>
          <label className={labelClass}>Location *</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
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
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={5}
          className={inputClass}
          placeholder="Separate paragraphs with blank lines..."
        />
      </div>

      <ImageUpload label="Hero image *" value={heroUrl} onChange={setHeroUrl} />

      <GalleryEditor
        label="Gallery"
        gallery={gallery}
        onGalleryChange={setGallery}
        heroUrl={heroUrl}
        onHeroChange={setHeroUrl}
        socialCoverUrl={socialCoverUrl}
        onSocialCoverChange={setSocialCoverUrl}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Agent name</label>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Agent brokerage</label>
          <input
            value={agentBrokerage}
            onChange={(e) => setAgentBrokerage(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          className="accent-accent"
        />
        <span>Featured</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Action buttons. Different surface area depending on create vs edit and role. */}
      {isEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={submitEdit}
            className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitCreate("draft")}
            className="border border-black/30 px-6 py-3 text-sm uppercase tracking-widest hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Save as draft
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitCreate("review")}
            className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
          >
            {isOwner ? "Submit for review" : "Submit for review"}
          </button>
          {isOwner && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitCreate("published")}
              className="bg-accent text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
            >
              Publish now
            </button>
          )}
        </div>
      )}
    </form>
  );
}
