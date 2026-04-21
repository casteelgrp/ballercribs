// Single source of truth for agent-feature price tiers. Keys are semantic
// (not coupled to current pricing); changing amountCents here is a one-file
// edit and doesn't require a data migration. The admin UI and server
// validation both read from this object.
//
// 'custom' has amountCents=null — the admin is expected to provide a
// per-deal amount at link generation time.

export type TierKey = "featured" | "premium" | "elite" | "custom";

export interface TierConfig {
  label: string;
  amountCents: number | null;
  /** Shown in the hosted checkout line item + email receipt. */
  description: string;
}

// TODO: dial in the marketing labels + descriptions once we've settled the
// agent-facing copy. Functional for now; nothing here is customer-facing
// until an agent receives a payment email.
export const TIERS: Record<TierKey, TierConfig> = {
  featured: {
    label: "Featured Listing",
    amountCents: 150_000,
    description: "Featured Listing — single property, fully promoted across BallerCribs channels."
  },
  premium: {
    label: "Premium Placement",
    amountCents: 375_000,
    description: "Premium Placement — three featured listings over 30 days."
  },
  elite: {
    label: "Elite Takeover",
    amountCents: 500_000,
    description: "Elite Takeover — dedicated week, multiple posts, priority newsletter placement."
  },
  custom: {
    label: "Custom Quote",
    amountCents: null,
    description: "Custom engagement — amount set by BallerCribs."
  }
};

export const TIER_KEYS: readonly TierKey[] = ["featured", "premium", "elite", "custom"];

export function isTierKey(value: unknown): value is TierKey {
  return typeof value === "string" && (TIER_KEYS as readonly string[]).includes(value);
}

/** Resolves the price for a tier, validating custom-amount constraints. */
export function resolveTierAmount(
  tier: TierKey,
  customAmountCents?: number | null
): { ok: true; amount_cents: number } | { ok: false; error: string } {
  if (tier === "custom") {
    if (
      customAmountCents === undefined ||
      customAmountCents === null ||
      !Number.isInteger(customAmountCents) ||
      customAmountCents < 100
    ) {
      return { ok: false, error: "custom tier requires amount_cents >= 100 (at least $1)." };
    }
    return { ok: true, amount_cents: customAmountCents };
  }
  const cfg = TIERS[tier];
  if (cfg.amountCents === null) {
    return { ok: false, error: `Tier ${tier} has no fixed price configured.` };
  }
  if (customAmountCents !== undefined && customAmountCents !== null) {
    return {
      ok: false,
      error: `amount_cents can only be set when tier is 'custom'.`
    };
  }
  return { ok: true, amount_cents: cfg.amountCents };
}
