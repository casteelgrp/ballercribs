// Supported listing display currencies. Keep this small and hardcoded —
// luxury RE doesn't need 180 ISO codes and keeping the set tight means
// the admin dropdown stays short + scanable. Adding a new currency is a
// one-row append (code / symbol / name / placement). USD stays default.
//
// Everything in this file is display-layer: we never convert amounts
// between currencies. A listing stored as `6_950_000 CAD` renders as
// `CA$6.95M` and that's the end of it.

export type CurrencyCode =
  | "USD"
  | "CAD"
  | "EUR"
  | "GBP"
  | "MXN"
  | "AED"
  | "CHF"
  | "AUD";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /**
   * Where the symbol sits relative to the amount. Every currency we support
   * today is `before`; kept as a field so adding a post-fix symbol later
   * (e.g. Swedish kronor: `1,000,000 kr`) doesn't require a refactor.
   */
  placement: "before" | "after";
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", placement: "before" },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar", placement: "before" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", placement: "before" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", placement: "before" },
  MXN: { code: "MXN", symbol: "MX$", name: "Mexican Peso", placement: "before" },
  AED: { code: "AED", symbol: "AED", name: "UAE Dirham", placement: "before" },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", placement: "before" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", placement: "before" }
};

export const CURRENCY_CODES: readonly CurrencyCode[] = Object.keys(
  CURRENCIES
) as CurrencyCode[];

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === "string" && (CURRENCY_CODES as readonly string[]).includes(v);
}

/**
 * Resolve an arbitrary stored value to a known currency config. Falls back
 * to USD so a row with a stale or misspelled code still renders cleanly.
 */
export function resolveCurrency(code: string | null | undefined): CurrencyConfig {
  if (code && isCurrencyCode(code)) return CURRENCIES[code];
  return CURRENCIES[DEFAULT_CURRENCY];
}

// ─── Formatter ──────────────────────────────────────────────────────────────

export interface FormatPriceOptions {
  /**
   * Compact mode collapses to M/B suffix for luxury-RE headlines (`$19.9M`)
   * instead of full commas (`$19,900,000`). Default true, matching the
   * previous single-arg formatPrice behavior.
   */
  compact?: boolean;
}

/**
 * Render an amount in a listing's native currency.
 *
 * Intl.NumberFormat is used for comma grouping in the non-compact path, but
 * the compact path hand-formats so we match the editorial style the site
 * already uses — Intl's "compact" mode would give us `$20M` for 19.9M
 * because it rounds half-to-even, and `$19.9M` is the shape Zillow /
 * Sotheby's / the existing site all use. Symbols longer than one char
 * (AED / CHF) get a space after to avoid "AED25M" reading as one blob.
 */
export function formatPrice(
  amount: number,
  code: string | null | undefined,
  options: FormatPriceOptions = {}
): string {
  const compact = options.compact ?? true;
  const currency = resolveCurrency(code);
  const sym = currency.symbol;
  // Space after multi-char letter-symbols (AED, CHF) so the amount is
  // visually separate. Single-char/unicode symbols ($, €, £) butt up.
  const needsSpace = /^[A-Za-z]{2,}$/.test(sym);
  const space = needsSpace ? " " : "";

  const body = compact ? compactAmount(amount) : withCommas(amount);

  if (currency.placement === "after") {
    return `${body}${space || " "}${sym}`;
  }
  return `${sym}${space}${body}`;
}

/**
 * Compact formatter: `6_950_000` → `6.95M`, `19_900_000` → `19.9M`,
 * `25_000_000` → `25M`, `850_000` → `850,000`, `1_250_000_000` → `1.25B`.
 *
 * Precision rule: format to 2 decimals then strip trailing zeros (and the
 * dot if they're all gone). This preserves meaningful tens-of-thousands
 * precision on values like `6.95M` without adding noise on round numbers
 * like `25M`. Sub-million stays in full commas — a "K" suffix reads as
 * discount retail on luxury RE and we don't want it.
 */
function compactAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    const v = amount / 1_000_000_000;
    return `${stripTrailingZero(v.toFixed(2))}B`;
  }
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${stripTrailingZero(v.toFixed(2))}M`;
  }
  return withCommas(amount);
}

function withCommas(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(amount);
}

/** "1.20B" → "1.2B", "1.00B" → "1B". Keeps compact format crisp. */
function stripTrailingZero(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}
