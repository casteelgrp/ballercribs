"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewListingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = e.currentTarget;
    const fd = new FormData(form);

    const galleryRaw = String(fd.get("gallery_image_urls") || "").trim();
    const gallery_image_urls = galleryRaw
      ? galleryRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

    const payload = {
      slug: String(fd.get("slug") || "").trim() || null,
      title: String(fd.get("title") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      price_usd: Number(fd.get("price_usd") || 0),
      bedrooms: fd.get("bedrooms") ? Number(fd.get("bedrooms")) : null,
      bathrooms: fd.get("bathrooms") ? Number(fd.get("bathrooms")) : null,
      square_feet: fd.get("square_feet") ? Number(fd.get("square_feet")) : null,
      description: String(fd.get("description") || "").trim(),
      hero_image_url: String(fd.get("hero_image_url") || "").trim(),
      gallery_image_urls,
      agent_name: String(fd.get("agent_name") || "").trim() || null,
      agent_brokerage: String(fd.get("agent_brokerage") || "").trim() || null,
      featured: fd.get("featured") === "on"
    };

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create listing.");
      }
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const input = "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
  const label = "block text-xs uppercase tracking-widest text-black/60 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={label}>Title *</label>
          <input name="title" required className={input} placeholder="Bel Air Modern Estate" />
        </div>
        <div>
          <label className={label}>Slug (optional — auto-generated)</label>
          <input name="slug" className={input} placeholder="bel-air-modern-estate" />
        </div>
        <div>
          <label className={label}>Location *</label>
          <input name="location" required className={input} placeholder="Bel Air, CA" />
        </div>
        <div>
          <label className={label}>Price (USD) *</label>
          <input name="price_usd" type="number" required min="0" className={input} placeholder="25000000" />
        </div>
        <div>
          <label className={label}>Bedrooms</label>
          <input name="bedrooms" type="number" min="0" className={input} />
        </div>
        <div>
          <label className={label}>Bathrooms</label>
          <input name="bathrooms" type="number" min="0" step="0.5" className={input} />
        </div>
        <div>
          <label className={label}>Square feet</label>
          <input name="square_feet" type="number" min="0" className={input} />
        </div>
      </div>

      <div>
        <label className={label}>Description *</label>
        <textarea name="description" required rows={5} className={input} placeholder="Separate paragraphs with blank lines..." />
      </div>

      <div>
        <label className={label}>Hero image URL *</label>
        <input name="hero_image_url" type="url" required className={input} placeholder="https://..." />
      </div>

      <div>
        <label className={label}>Gallery image URLs (one per line)</label>
        <textarea name="gallery_image_urls" rows={4} className={input} placeholder="https://...&#10;https://..." />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Agent name</label>
          <input name="agent_name" className={input} />
        </div>
        <div>
          <label className={label}>Agent brokerage</label>
          <input name="agent_brokerage" className={input} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input name="featured" type="checkbox" className="accent-accent" />
        <span>Featured</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create listing"}
      </button>
    </form>
  );
}
