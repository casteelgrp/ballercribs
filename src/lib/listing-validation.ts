import type { ListingType, RentalPriceUnit, RentalTerm } from "./types";

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
 *   - rental → rental_term ∈ {'short_term','long_term'}
 *   - rental short_term → unit ∈ {'night','week'}
 *   - rental long_term → unit = 'month'
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

  const termRaw = String(b?.rental_term ?? "");
  if (termRaw !== "short_term" && termRaw !== "long_term") {
    return {
      ok: false,
      error: "rental_term must be 'short_term' or 'long_term'."
    };
  }
  const rental_term: RentalTerm = termRaw;

  const unitRaw = String(b?.rental_price_unit ?? "");
  if (
    (rental_term === "short_term" && unitRaw !== "night" && unitRaw !== "week") ||
    (rental_term === "long_term" && unitRaw !== "month")
  ) {
    return {
      ok: false,
      error:
        rental_term === "short_term"
          ? "Short-term rental price unit must be 'night' or 'week'."
          : "Long-term rental price unit must be 'month'."
    };
  }
  const rental_price_unit = unitRaw as RentalPriceUnit;

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
