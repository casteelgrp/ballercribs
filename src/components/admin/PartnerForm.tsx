"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";
import type { Partner, PartnerCtaMode, PartnerType } from "@/lib/types";

/**
 * Shared form for /admin/partners/new and /admin/partners/[id]/edit.
 * `existing` is null on the create path; the form posts to /api/admin/partners.
 * Edit posts a PATCH to /api/admin/partners/{id}.
 *
 * Conditional `forward_inquiries_to` field: re-evaluated on every
 * cta_mode change because the value lives in component state, not
 * route props — switching modes mid-edit immediately shows/hides the
 * field, and validation gates on the live cta_mode (not the initial).
 *
 * Slug uniqueness on edit: server-side check excludes the current
 * partner's id, so saving without changing the slug doesn't fail
 * against itself. Form just surfaces 409 errors from the API.
 *
 * Mode-switch warning when rentals are attached: per-partner
 * `attachedRentalCount` prop is non-null only on edit; switching
 * cta_mode from inquiry_form → outbound_link triggers a
 * window.confirm before submit because the existing rental rows
 * would become invalid (no URLs set).
 */
const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function PartnerForm({
  existing,
  attachedRentalCount
}: {
  existing: Partner | null;
  /** Number of rentals currently linked to this partner. Edit-only. */
  attachedRentalCount?: number;
}) {
  const router = useRouter();
  const isEdit = Boolean(existing);

  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [type, setType] = useState<PartnerType>(existing?.type ?? "affiliate");
  const [ctaMode, setCtaMode] = useState<PartnerCtaMode>(
    existing?.cta_mode ?? "outbound_link"
  );
  const [ctaLabel, setCtaLabel] = useState(existing?.cta_label ?? "");
  const [logoUrl, setLogoUrl] = useState(existing?.logo_url ?? "");
  const [disclosureText, setDisclosureText] = useState(
    existing?.disclosure_text ?? ""
  );
  const [forwardInquiriesTo, setForwardInquiriesTo] = useState(
    existing?.forward_inquiries_to ?? ""
  );
  const [active, setActive] = useState(existing?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slugErr = useMemo(() => {
    const s = slug.trim();
    if (!s) return null;
    if (!SLUG_RX.test(s)) return "Use lowercase letters, numbers, and hyphens only.";
    return null;
  }, [slug]);

  function validate(): string | null {
    if (!name.trim()) return "Name is required.";
    if (!slug.trim()) return "Slug is required.";
    if (slugErr) return slugErr;
    if (!ctaLabel.trim()) return "CTA label is required.";
    // Conditional gate: forward_inquiries_to required only when the
    // currently-selected cta_mode is inquiry_form. Re-evaluating on
    // every render means flipping the radio mid-form removes/adds the
    // requirement instantly without stale state.
    if (ctaMode === "inquiry_form" && !forwardInquiriesTo.trim()) {
      return "Forward inquiries to is required for inquiry-form partners.";
    }
    if (
      ctaMode === "inquiry_form" &&
      forwardInquiriesTo.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardInquiriesTo.trim())
    ) {
      return "Forward inquiries to must be a valid email.";
    }
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    // Mode-switch confirm: if this partner has rentals attached and
    // the admin is flipping inquiry_form → outbound_link, those rows
    // will need URLs added before they validate again. The actual
    // listings UPDATE doesn't run until the rentals admin form is
    // touched, but the warning surfaces the breakage early.
    if (
      isEdit &&
      attachedRentalCount &&
      attachedRentalCount > 0 &&
      existing?.cta_mode === "inquiry_form" &&
      ctaMode === "outbound_link"
    ) {
      const ok = window.confirm(
        `This partner has ${attachedRentalCount} rental${attachedRentalCount === 1 ? "" : "s"} using inquiry-form mode. Switching modes will break those rentals until you add property URLs to each. Continue?`
      );
      if (!ok) return;
    }

    setError("");
    setSubmitting(true);

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      type,
      cta_mode: ctaMode,
      cta_label: ctaLabel.trim(),
      logo_url: logoUrl.trim() || null,
      disclosure_text: disclosureText.trim() || null,
      // Always send — server clobbers the column either way. When
      // cta_mode switches outbound_link the empty string becomes
      // null which is the correct "no forwarding email" state.
      forward_inquiries_to:
        ctaMode === "inquiry_form" ? forwardInquiriesTo.trim() : null,
      active
    };

    try {
      const url = isEdit
        ? `/api/admin/partners/${existing!.id}`
        : "/api/admin/partners";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed.");
      }
      router.push("/admin/partners");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
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
        <label className={labelClass} htmlFor="partner-name">
          Name *
        </label>
        <input
          id="partner-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Villanovo"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="partner-slug">
          Slug *
        </label>
        <input
          id="partner-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={inputClass}
          placeholder="villanovo"
          aria-invalid={slugErr ? true : undefined}
        />
        {slugErr && <p className="mt-1 text-xs text-red-600">{slugErr}</p>}
        <p className="mt-1 text-xs text-black/50">
          Lowercase, kebab-case, unique across all partners.
        </p>
      </div>

      <fieldset>
        <legend className={labelClass}>Type *</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="partner-type"
              checked={type === "affiliate"}
              onChange={() => setType("affiliate")}
              className="accent-accent"
            />
            <span>Affiliate</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="partner-type"
              checked={type === "direct"}
              onChange={() => setType("direct")}
              className="accent-accent"
            />
            <span>Direct</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>CTA mode *</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="partner-cta-mode"
              checked={ctaMode === "outbound_link"}
              onChange={() => setCtaMode("outbound_link")}
              className="accent-accent"
            />
            <span>Outbound link</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="partner-cta-mode"
              checked={ctaMode === "inquiry_form"}
              onChange={() => setCtaMode("inquiry_form")}
              className="accent-accent"
            />
            <span>Inquiry form</span>
          </label>
        </div>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="partner-cta-label">
          CTA label *
        </label>
        <input
          id="partner-cta-label"
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          className={inputClass}
          placeholder="Book on Villanovo"
        />
        <p className="mt-1 text-xs text-black/50">
          What the button says, e.g., &ldquo;Book on Villanovo&rdquo; or
          &ldquo;Inquire with Aspen Luxury Rentals&rdquo;.
        </p>
      </div>

      {/* Logo upload — same component the listing hero + blog cover
          use, including the "or paste a URL" fallback for SVG logos
          hosted elsewhere. Public render gets alt text auto-derived
          as `${partner.name} logo` — no separate alt field on the
          form because the partner's own name is the only honest
          description. */}
      <ImageUpload label="Logo" value={logoUrl} onChange={setLogoUrl} />
      <p className="-mt-2 text-xs text-black/50">
        Optional. Rendered on every rental detail page from this partner;
        leave blank to fall back to the partner name in heading style.
      </p>

      <div>
        <label className={labelClass} htmlFor="partner-disclosure">
          Disclosure text
        </label>
        <textarea
          id="partner-disclosure"
          rows={3}
          value={disclosureText}
          onChange={(e) => setDisclosureText(e.target.value)}
          className={inputClass}
          placeholder="As a Villanovo affiliate, BallerCribs may earn a commission on bookings made through our links."
        />
        <p className="mt-1 text-xs text-black/50">
          Affiliate disclosure or partner-specific legal language.
          Rendered below the booking block on every rental from this
          partner. Leave blank if not required.
        </p>
      </div>

      {/* Conditional — re-renders on every cta_mode change so toggling
          the radio above instantly adds/removes the requirement. */}
      {ctaMode === "inquiry_form" && (
        <div>
          <label className={labelClass} htmlFor="partner-forward-email">
            Forward inquiries to *
          </label>
          <input
            id="partner-forward-email"
            type="email"
            value={forwardInquiriesTo}
            onChange={(e) => setForwardInquiriesTo(e.target.value)}
            className={inputClass}
            placeholder="leads@aspenluxuryrentals.com"
          />
          <p className="mt-1 text-xs text-black/50">
            Email address where we forward leads from this partner&apos;s rentals.
          </p>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-accent"
          />
          <span>Active</span>
        </label>
        <p className="mt-1 text-xs text-black/50">
          Inactive partners disappear from the rental form&apos;s partner
          dropdown but stay attached to existing rentals.
        </p>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create partner"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/partners")}
          className="border border-black/20 px-5 py-2 text-sm uppercase tracking-widest hover:border-black/50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
