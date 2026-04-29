import type { ListingType, Partner, RentalPriceUnit, RentalTerm } from "./types";

/**
 * Resolved rental-vs-sale field shape for a listing write. Callers in
 * /api/listings (POST) and /api/admin/listings/[id] (PATCH) share the
 * same rules via resolveRentalFields — keeps the cross-field validation
 * (unit must match term, rental-required-when-rental etc) in one place.
 */
export type RentalFieldResolution = {
  listing_type: ListingType;
  rental_term: RentalTerm | null;
  rental_price_cents: number | null;
  rental_price_unit: RentalPriceUnit | null;
  /**
   * When the caller switches to rental, price_usd should be reset to 0.
   * Null = leave sale-side price alone (the sale path).
   */
  sale_price_override: number | null;
};

/**
 * Validate the listing_type + rental_* fields of an arbitrary payload.
 * Returns a normalized RentalFieldResolution on success, or a plain
 * error string on failure.
 *
 * Rules:
 *   - listing_type ∈ {'sale','rental'} (default 'sale' when absent)
 *   - sale → all rental fields must be null
 *   - rental → rental_term is forced to 'short_term' (long-term is out of
 *     scope product-side; any client-sent value is ignored)
 *   - rental → rental_price_unit ∈ {'night','week'}
 *   - rental price must be a positive integer (cents of listing currency)
 */
export function resolveRentalFields(
  body: unknown
): { ok: true; data: RentalFieldResolution } | { ok: false; error: string } {
  const b = body as Record<string, unknown>;
  const typeRaw = String(b?.listing_type ?? "sale");
  if (typeRaw !== "sale" && typeRaw !== "rental") {
    return { ok: false, error: "listing_type must be 'sale' or 'rental'." };
  }
  const listing_type: ListingType = typeRaw;

  if (listing_type === "sale") {
    return {
      ok: true,
      data: {
        listing_type: "sale",
        rental_term: null,
        rental_price_cents: null,
        rental_price_unit: null,
        sale_price_override: null
      }
    };
  }

  const rental_term: RentalTerm = "short_term";

  const unitRaw = String(b?.rental_price_unit ?? "");
  if (unitRaw !== "night" && unitRaw !== "week") {
    return {
      ok: false,
      error: "Rental price unit must be 'night' or 'week'."
    };
  }
  const rental_price_unit: RentalPriceUnit = unitRaw;

  const priceCents = Number(b?.rental_price_cents);
  if (!Number.isFinite(priceCents) || priceCents <= 0 || !Number.isInteger(priceCents)) {
    return {
      ok: false,
      error: "rental_price_cents must be a positive integer (cents of the listing's currency)."
    };
  }

  return {
    ok: true,
    data: {
      listing_type: "rental",
      rental_term,
      rental_price_cents: priceCents,
      rental_price_unit,
      sale_price_override: 0
    }
  };
}

/**
 * Cross-field partner validation for listing writes (D9). Sale listings
 * forbid partner linkage; rentals require it. The partner's cta_mode
 * drives whether URLs are required (outbound_link) or must be NULL
 * (inquiry_form) — admin can't ship URL fields against an inquiry-form
 * partner because the public booking block wouldn't surface them.
 *
 * Caller responsibility:
 *   - Pass the resolved listing_type from resolveRentalFields.
 *   - Look up `partner` from the DB by the body's partner_id BEFORE
 *     calling this; pass null when partner_id is missing or unknown.
 *
 * Returns the sanitized fields ready for createListing/updateListing.
 * URLs come back null on inquiry_form partners regardless of what the
 * client sent — defensive cleanup so a mode-switch from outbound_link →
 * inquiry_form doesn't leave orphan partner_property_url /
 * partner_tracking_url values in the DB.
 */
export type PartnerFieldResolution = {
  partner_id: string | null;
  partner_property_url: string | null;
  partner_tracking_url: string | null;
};

export function resolvePartnerFields(
  body: unknown,
  listing_type: ListingType,
  partner: Partner | null
):
  | { ok: true; data: PartnerFieldResolution }
  | { ok: false; error: string } {
  const b = body as Record<string, unknown>;

  if (listing_type === "sale") {
    // Sale listings keep partner state out — the form might still send
    // a stray partner_id from a flip mid-edit, but we always strip it.
    return {
      ok: true,
      data: {
        partner_id: null,
        partner_property_url: null,
        partner_tracking_url: null
      }
    };
  }

  // Rental: must have a partner.
  if (!partner) {
    return {
      ok: false,
      error:
        "Rentals require a booking partner. Pick one from the partner dropdown."
    };
  }
  if (!partner.active) {
    // Editing an existing rental whose partner has since gone inactive
    // is allowed (the dropdown surfaces the inactive partner specifically
    // so saves don't fail). New attachments to inactive partners are
    // not — the dropdown only renders active rows for unattached
    // listings, but the route stays defensive.
    // We don't flag here; caller decides via attachedPartnerId comparison.
  }

  if (partner.cta_mode === "inquiry_form") {
    // Always NULL the URLs on inquiry-form rentals, regardless of
    // what the client sent. Mode-switch from outbound_link →
    // inquiry_form is the canonical case — the URL state on the form
    // becomes invalid the moment the partner changes, and the server
    // is the last gate.
    return {
      ok: true,
      data: {
        partner_id: partner.id,
        partner_property_url: null,
        partner_tracking_url: null
      }
    };
  }

  // outbound_link: both URLs required.
  const propertyUrlRaw = b?.partner_property_url;
  const trackingUrlRaw = b?.partner_tracking_url;
  const propertyUrl =
    typeof propertyUrlRaw === "string" ? propertyUrlRaw.trim() : "";
  const trackingUrl =
    typeof trackingUrlRaw === "string" ? trackingUrlRaw.trim() : "";

  if (!propertyUrl) {
    return {
      ok: false,
      error: "Partner property URL is required for outbound-link partners."
    };
  }
  if (!trackingUrl) {
    return {
      ok: false,
      error: "Partner tracking URL is required for outbound-link partners."
    };
  }
  if (!/^https?:\/\//i.test(propertyUrl)) {
    return { ok: false, error: "Partner property URL must be http(s)." };
  }
  if (!/^https?:\/\//i.test(trackingUrl)) {
    return { ok: false, error: "Partner tracking URL must be http(s)." };
  }

  return {
    ok: true,
    data: {
      partner_id: partner.id,
      partner_property_url: propertyUrl,
      partner_tracking_url: trackingUrl
    }
  };
}
