"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DescriptionEditor } from "./DescriptionEditor";
import { ImageUpload } from "./ImageUpload";
import { GalleryEditor } from "./GalleryEditor";
import { ListingDescription } from "./ListingDescription";
import { generateSlug, validateSlug } from "@/lib/format";
import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY, formatPrice } from "@/lib/currency";
import type {
  GalleryItem,
  Listing,
  ListingStatus,
  ListingType,
  Partner,
  RentalPriceUnit,
  User
} from "@/lib/types";

type Props = {
  /** Current logged-in user — drives which status actions are available. */
  currentUser: User;
  /** When provided, the form starts in edit mode (PATCH endpoint). Otherwise it creates. */
  existing?: Listing;
  /** Render all fields disabled, hide save buttons. */
  readOnly?: boolean;
  /**
   * Partners available in the rental dropdown. Pages compute this
   * server-side: getActivePartners() for new listings, plus the
   * existing listing's partner prepended (even if inactive) so an
   * edit can always re-save without dropping its partner pointer.
   */
  partners?: Partner[];
};

export function ListingForm({
  currentUser,
  existing,
  readOnly = false,
  partners = []
}: Props) {
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
  const [currency, setCurrency] = useState<string>(existing?.currency ?? DEFAULT_CURRENCY);
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

  // Optional SEO overrides — null/empty means the public page falls back to
  // auto-derived <title> and <meta description> via generateMetadata. The
  // section stays collapsed by default since most listings don't need it.
  const [seoTitle, setSeoTitle] = useState(existing?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(existing?.seo_description ?? "");

  // ─── Listing type + rental fields ──────────────────────────────────────
  //
  // Toggle at the top of the form; switching to rental hides sale-specific
  // inputs and surfaces a rental details section. Rental price is stored
  // in cents of the listing's currency — the UI collects whole-currency
  // units and we convert before submit. Rental term is fixed to
  // 'short_term' at the product layer (see listing-validation.ts).
  const [listingType, setListingType] = useState<ListingType>(
    existing?.listing_type ?? "sale"
  );
  const [rentalPriceDollars, setRentalPriceDollars] = useState<string>(() => {
    if (existing?.rental_price_cents === null || existing?.rental_price_cents === undefined) {
      return "";
    }
    return String(existing.rental_price_cents / 100);
  });
  // Historical long_term listings stored 'month' on this column; migration
  // 015 flipped every extant row to 'night', but if we ever open a legacy
  // row that slipped through, fall back to 'night' rather than crashing
  // the select with a value outside its new option list.
  const [rentalPriceUnit, setRentalPriceUnit] = useState<RentalPriceUnit>(
    existing?.rental_price_unit === "night" || existing?.rental_price_unit === "week"
      ? existing.rental_price_unit
      : "night"
  );

  // Partner attribution. partner_id required on rentals. URL fields
  // surface only when the selected partner's cta_mode is outbound_link;
  // mode-switch cleanup happens at the wire layer (commonFields), not
  // by clobbering local state, so a flip-back recovers what was typed.
  const [partnerId, setPartnerId] = useState<string>(existing?.partner_id ?? "");
  const [partnerPropertyUrl, setPartnerPropertyUrl] = useState<string>(
    existing?.partner_property_url ?? ""
  );
  const [partnerTrackingUrl, setPartnerTrackingUrl] = useState<string>(
    existing?.partner_tracking_url ?? ""
  );
  const selectedPartner = partners.find((p) => p.id === partnerId) ?? null;

  function commonFields() {
    const isRental = listingType === "rental";
    const rentalPriceCents = isRental
      ? (() => {
          const n = Number(rentalPriceDollars);
          return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
        })()
      : null;
    return {
      title: title.trim(),
      slug: slug.trim() || null,
      location: location.trim(),
      // Rentals store 0 on the sale-side price; the server enforces this
      // too, but sending 0 keeps the wire shape predictable.
      price_usd: isRental ? 0 : Number(priceUsd),
      currency,
      bedrooms: bedrooms === "" ? null : Number(bedrooms),
      bathrooms: bathrooms === "" ? null : Number(bathrooms),
      square_feet: squareFeet === "" ? null : Number(squareFeet),
      description: description.trim(),
      hero_image_url: heroUrl.trim(),
      gallery_image_urls: gallery,
      social_cover_url: socialCoverUrl,
      // Sales carry the listing agent; rentals strip them on the wire
      // even if state still has values (mode-flip → flip-back path).
      agent_name: isRental ? null : agentName.trim() || null,
      agent_brokerage: isRental ? null : agentBrokerage.trim() || null,
      listing_type: listingType,
      // Always short_term on the write path — long-term rentals are out of
      // scope product-side, enforced in resolveRentalFields too.
      rental_term: isRental ? "short_term" : null,
      rental_price_cents: rentalPriceCents,
      rental_price_unit: isRental ? rentalPriceUnit : null,
      // Partner shape mirrors server's resolvePartnerFields:
      //   - sales: everything null (the route strips on its end too)
      //   - rental + inquiry_form: partner_id only, URLs null
      //   - rental + outbound_link: partner_id + both trimmed URLs
      // The mode resolution lives off selectedPartner.cta_mode, which
      // re-evaluates every render — flipping the partner dropdown
      // immediately changes what gets shipped without touching state.
      partner_id: isRental && partnerId ? partnerId : null,
      partner_property_url:
        isRental && selectedPartner?.cta_mode === "outbound_link"
          ? partnerPropertyUrl.trim() || null
          : null,
      partner_tracking_url:
        isRental && selectedPartner?.cta_mode === "outbound_link"
          ? partnerTrackingUrl.trim() || null
          : null,
      featured,
      // Empty → null so the DB stores a clean NULL and generateMetadata
      // knows to fall back to the auto-derived title/description.
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null
    };
  }

  function validate(): string | null {
    if (!title.trim()) return "Title is required.";
    if (!location.trim()) return "Location is required.";
    if (!description.trim()) return "Description is required.";
    if (!heroUrl.trim()) return "Hero image is required.";

    if (listingType === "sale") {
      const p = Number(priceUsd);
      if (!Number.isFinite(p) || p < 0) return "Valid price is required.";
    } else {
      const rp = Number(rentalPriceDollars);
      if (!Number.isFinite(rp) || rp <= 0) {
        return "Rental price is required.";
      }
      if (rentalPriceUnit !== "night" && rentalPriceUnit !== "week") {
        return "Rentals price per night or per week.";
      }
      // Partner gates — server enforces these too, but client-side
      // validation keeps the user on the form for fixable mistakes
      // instead of round-tripping a 400.
      if (!partnerId) {
        return "Pick a booking partner for this rental.";
      }
      if (selectedPartner?.cta_mode === "outbound_link") {
        if (!partnerPropertyUrl.trim()) {
          return "Partner property URL is required for this partner.";
        }
        if (!partnerTrackingUrl.trim()) {
          return "Partner tracking URL is required for this partner.";
        }
      }
    }

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

        // Every create path (Save Draft / Submit for Review / Publish Now) now
        // routes to /admin/listings with a matching toast, since the creation
        // form lives on its own page and there's no listings table to refresh
        // in place.
        const toastKey =
          transitionTo === "review"
            ? "submitted"
            : transitionTo === "published"
              ? "published"
              : "draft_saved";
        router.push(`/admin/listings?toast=${toastKey}`);
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
        router.push(`/admin/listings?toast=${toastKey}`);
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

  // Saved confirmation banner — rendered both at the top (next to the top
  // save button) and at the bottom (next to the full button row). User clicks
  // either button → sees feedback in the same place they clicked.
  const savedBanner =
    savedNotice && !readOnly ? (
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
    ) : null;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {/* Top-of-form save bar — only shown for already-saved listings so users
          editing a long form don't have to scroll to the bottom to save.
          Sticky at top-16 matches SiteHeader's h-16 so the bar pins flush
          below the site nav instead of sliding behind it. z-20 sits above
          normal flow but below SiteHeader's z-40 (which wins overlaps) and
          below modal z-50s. */}
      {!readOnly && isPersisted && (
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-black/10 sticky top-16 bg-white z-20">
          <button
            type="button"
            disabled={submitting}
            onClick={() => save()}
            className="bg-ink text-paper px-5 py-2.5 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : saveLabel}
          </button>
          {lastSavedAt && (
            <span className="text-xs text-black/50">
              Last saved {new Date(lastSavedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
      {savedBanner}

      {/* Listing type — sale vs rental. Pinned at the top so the sale-
          specific vs rental-specific inputs below render predictably from
          the very first paint. */}
      <fieldset>
        <legend className={labelClass}>Listing type</legend>
        <div className="flex gap-0 isolate mt-1" role="radiogroup">
          {(
            [
              { value: "sale" as const, label: "Sale" },
              { value: "rental" as const, label: "Rental" }
            ]
          ).map((opt, i) => {
            const active = listingType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => setListingType(opt.value)}
                className={
                  "px-4 py-2 text-xs uppercase tracking-widest border transition-colors " +
                  (i > 0 ? "-ml-px " : "") +
                  (active
                    ? "bg-ink text-paper border-ink"
                    : "bg-white text-black/60 border-black/20 hover:border-black/40")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

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
        {listingType === "sale" ? (
          <div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label className={labelClass}>Price *</label>
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
                <label className={labelClass}>Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={disabled}
                  className={inputClass + " pr-8 min-w-[7rem]"}
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code} — {CURRENCIES[code].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-1 text-xs text-black/50">
              Enter the price in the selected currency's base units (e.g. 6950000 for{" "}
              {formatPrice(6950000, currency)}).
            </p>
          </div>
        ) : null /* Rental currency is rendered inline with the Rental
                     price below, not in the sale-price slot. Keeps the
                     currency visually paired with the number it applies
                     to instead of floating at the top of the form. */}
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

      {/* Booking partner section — rentals only. Partner choice drives
          the public booking-block render shape: outbound_link partners
          get tracking-URL CTAs, inquiry_form partners route through
          the universal /rentals form. URL fields below render only
          when the selected partner needs them. */}
      {listingType === "rental" && (
        <fieldset className="border border-black/10 bg-black/[0.02] p-4 space-y-4">
          <legend className="px-2 text-xs uppercase tracking-widest text-black/60">
            Booking partner
          </legend>

          <div>
            <label className={labelClass} htmlFor="listing-partner">
              Partner *
            </label>
            <select
              id="listing-partner"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              disabled={disabled}
              className={inputClass + " pr-8"}
            >
              <option value="">— Select partner —</option>
              {partners.map((p) => {
                const typeLabel = p.type === "affiliate" ? "affiliate" : "direct";
                const modeLabel =
                  p.cta_mode === "outbound_link" ? "outbound" : "inquiry";
                const inactiveTag = p.active ? "" : " · inactive";
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({typeLabel}, {modeLabel}
                    {inactiveTag})
                  </option>
                );
              })}
            </select>
            {partners.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No active partners. Create one at /admin/partners before
                attaching a rental.
              </p>
            )}
          </div>

          {/* Conditional URL fields — appear only when the selected
              partner emits an outbound link. inquiry_form partners
              don't surface them; the universal inquiry form covers
              the routing. URL state stays mounted across mode flips
              so hopping back to outbound_link recovers what was typed. */}
          {selectedPartner?.cta_mode === "outbound_link" && (
            <>
              <div>
                <label className={labelClass} htmlFor="partner-property-url">
                  Partner property URL *
                </label>
                <input
                  id="partner-property-url"
                  type="url"
                  value={partnerPropertyUrl}
                  onChange={(e) => setPartnerPropertyUrl(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                  placeholder="https://www.villanovo.com/villas/villa-mandalay"
                />
                <p className="mt-1 text-xs text-black/55">
                  The URL of this property on the partner&apos;s site.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="partner-tracking-url">
                  Partner tracking URL *
                </label>
                <input
                  id="partner-tracking-url"
                  type="url"
                  value={partnerTrackingUrl}
                  onChange={(e) => setPartnerTrackingUrl(e.target.value)}
                  disabled={disabled}
                  className={inputClass}
                  placeholder="https://…?aff=ballercribs&utm_source=…"
                />
                <p className="mt-1 text-xs text-black/55">
                  Paste the full tracking link for this property from the
                  partner&apos;s affiliate dashboard. We&apos;ll use this for
                  the &ldquo;{selectedPartner.cta_label || "Book on …"}&rdquo;
                  button.
                </p>
              </div>
            </>
          )}
        </fieldset>
      )}

      {listingType === "rental" && (
        <fieldset className="border border-black/10 bg-black/[0.02] p-4 space-y-4">
          <legend className="px-2 text-xs uppercase tracking-widest text-black/60">
            Rental details
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
            <div>
              <label className={labelClass}>Rental price *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rentalPriceDollars}
                onChange={(e) => setRentalPriceDollars(e.target.value)}
                required={listingType === "rental"}
                disabled={disabled}
                className={inputClass}
                placeholder="2500"
              />
            </div>
            {/* Currency lives alongside the rental price so it's obvious
                which number it applies to. Sale listings render currency
                next to Price at the top of the form instead. */}
            <div>
              <label className={labelClass}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={disabled}
                className={inputClass + " pr-8"}
              >
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} — {CURRENCIES[code].name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Per</label>
              <select
                value={rentalPriceUnit}
                onChange={(e) => setRentalPriceUnit(e.target.value as RentalPriceUnit)}
                disabled={disabled}
                className={inputClass + " pr-8 min-w-[6rem]"}
              >
                <option value="night">per night</option>
                <option value="week">per week</option>
              </select>
            </div>
          </div>
        </fieldset>
      )}

      <div>
        <label className={labelClass}>Description *</label>
        {readOnly ? (
          // Render as the public site does so submitters can verify before approval.
          <div className="border border-black/10 bg-black/[0.02] px-3 py-3 text-sm">
            {description ? (
              <ListingDescription markdown={description} />
            ) : (
              <p className="text-black/40 italic">No description</p>
            )}
          </div>
        ) : (
          <DescriptionEditor
            value={description}
            onChange={setDescription}
            disabled={disabled}
            required
            rows={8}
            inputClass={inputClass}
            placeholder={
              "Separate paragraphs with blank lines. Use the toolbar for headings, bold, links…"
            }
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

      {/* Agent fields — sales only. Rentals don't have a listing
          agent in our model; the partner block above carries the
          fulfillment context instead. State stays mounted on a sale
          → rental flip so flipping back doesn't lose what was typed. */}
      {listingType === "sale" && (
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
      )}

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

      <SeoOverrides
        seoTitle={seoTitle}
        seoDescription={seoDescription}
        onTitleChange={setSeoTitle}
        onDescriptionChange={setSeoDescription}
        disabled={disabled}
      />

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

      {/* Saved confirmation duplicated at the bottom so the user sees feedback
          regardless of which save button they clicked (top or bottom). */}
      {savedBanner}
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

// ─── SEO overrides ─────────────────────────────────────────────────────────
//
// Collapsed by default — most listings don't need handcrafted SERP snippets.
// Character counters turn amber past the "safe" zone and red past the hard
// cap so the owner gets live feedback without truncation surprises on Google.

const TITLE_SAFE = 60;
const TITLE_WARN = 70;
const DESC_SAFE = 155;
const DESC_WARN = 170;

function counterTone(len: number, safeMax: number, warnMax: number): string {
  if (len === 0 || len <= safeMax) return "text-black/50";
  if (len <= warnMax) return "text-amber-700";
  return "text-red-600";
}

function SeoOverrides({
  seoTitle,
  seoDescription,
  onTitleChange,
  onDescriptionChange,
  disabled
}: {
  seoTitle: string;
  seoDescription: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  disabled: boolean;
}) {
  const inputClass =
    "w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-black/5 disabled:text-black/60 disabled:cursor-not-allowed";
  const labelClass = "block text-xs uppercase tracking-widest text-black/60 mb-1";
  const helpClass = "mt-1 text-xs text-black/50";
  const titleLen = seoTitle.length;
  const descLen = seoDescription.length;
  const hasOverrides = Boolean(seoTitle.trim() || seoDescription.trim());

  return (
    <details
      className="border border-black/10 bg-black/[0.02] group"
      // Auto-expand on edit when overrides already exist so the owner sees
      // what's there without hunting for the disclosure triangle.
      open={hasOverrides}
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm flex items-center justify-between hover:bg-black/5">
        <span className="uppercase tracking-widest text-xs text-black/70">SEO overrides</span>
        <span className="text-[11px] text-black/50 normal-case tracking-normal">
          {hasOverrides ? "Custom" : "Optional — click to customize"}
        </span>
      </summary>

      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-black/10">
        <div>
          <label className={labelClass} htmlFor="seo-title">
            SEO title (optional)
          </label>
          <input
            id="seo-title"
            type="text"
            value={seoTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Leave blank to use the listing title"
            disabled={disabled}
            className={inputClass}
          />
          <div className="flex items-start justify-between gap-3 mt-1">
            <p className={helpClass}>
              Customize how this listing appears in Google search results. Best under{" "}
              {TITLE_SAFE} characters.
            </p>
            <span
              aria-live="polite"
              className={"text-xs tabular-nums shrink-0 " + counterTone(titleLen, TITLE_SAFE, TITLE_WARN)}
            >
              {titleLen} / {TITLE_SAFE}
            </span>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="seo-description">
            SEO description (optional)
          </label>
          <textarea
            id="seo-description"
            rows={3}
            value={seoDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Leave blank to auto-generate from description"
            disabled={disabled}
            className={inputClass}
          />
          <div className="flex items-start justify-between gap-3 mt-1">
            <p className={helpClass}>
              Customize the blurb Google shows under the title. Best 120–{DESC_SAFE} characters.
              Write for human clickers, not keywords.
            </p>
            <span
              aria-live="polite"
              className={"text-xs tabular-nums shrink-0 " + counterTone(descLen, DESC_SAFE, DESC_WARN)}
            >
              {descLen} / {DESC_SAFE}
            </span>
          </div>
        </div>
      </div>
    </details>
  );
}
