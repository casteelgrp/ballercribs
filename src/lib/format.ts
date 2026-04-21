// Currency-aware price formatting lives in src/lib/currency.ts.
// format.ts is focused on non-currency helpers (sqft, slug generation,
// validation).

export function formatSqft(sqft: number | null): string {
  if (!sqft) return "—";
  return `${sqft.toLocaleString()} sq ft`;
}

// ─── Slug generation ───────────────────────────────────────────────────────

const STOP_WORDS = new Set<string>([
  "the", "a", "an", "is", "are", "for", "of", "in", "at", "on", "to",
  "and", "or", "but", "with", "this", "that", "these", "those", "its",
  "it's", "as", "be", "been", "being", "have", "has", "had", "do",
  "does", "did", "will", "would", "could", "should", "may", "might",
  "must", "can", "shall", "&",
  // Generic property nouns — stripped because every listing has them.
  "living", "home", "house", "property", "estate", "mansion", "residence"
]);

const RESERVED_SLUGS = new Set<string>([
  "admin", "api", "listings", "login", "new", "edit", "sold"
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 60;
const MIN_SLUG_LENGTH = 3;
const MAX_KEYWORDS = 3;

/** Lowercase, strip diacritics, collapse to a hyphenated alphanumeric token. */
function slugifyText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Split a string into lowercase alphanumeric tokens (drops all punctuation). */
function tokenize(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Extract the city/area prefix from the location field — text before the
 * first comma, slugified. "Los Angeles, CA" → "los-angeles". Empty → "".
 */
export function locationPrefix(location: string): string {
  if (!location) return "";
  const head = location.split(",")[0]?.trim() ?? "";
  return slugifyText(head);
}

/**
 * Build a memorable, SEO-friendly slug from title + location.
 *
 * Examples (verified by self-test in route handlers):
 *   "Beverly Park Fortress Is Elite Los Angeles Living" + "Los Angeles, CA"
 *      → "los-angeles-beverly-park-fortress"
 *   "2601 Twelve Oaks Lane — Celina Texas Estate" + "Celina, TX"
 *      → "celina-twelve-oaks-lane"   (3 keywords; 2601 stripped as long-number)
 *   "The Sandcastle Malibu Compound" + "Malibu, CA"
 *      → "malibu-sandcastle-compound"
 *   ""           + "Aspen, CO"  → "aspen"
 *   "Untitled"   + ""           → "untitled"
 *   ""           + ""           → "listing-<hash>"
 */
export function generateSlug(title: string, location: string): string {
  const locSlug = locationPrefix(location);
  const locTokens = locSlug ? new Set(locSlug.split("-")) : new Set<string>();

  const meaningful = tokenize(title).filter((t) => {
    if (STOP_WORDS.has(t)) return false;
    if (locTokens.has(t)) return false;
    // Pure-number address tokens — not memorable.
    // Spec says "longer than 4 digits" but the example wants "2601" (4 digits)
    // stripped. Going with ≥4 to match the example.
    if (/^\d{4,}$/.test(t)) return false;
    return true;
  });

  const keywordPart = meaningful.slice(0, MAX_KEYWORDS).join("-");

  let combined: string;
  if (locSlug && keywordPart) combined = `${locSlug}-${keywordPart}`;
  else if (keywordPart) combined = keywordPart;
  else if (locSlug) combined = locSlug;
  else combined = `listing-${shortHash((title || "") + "|" + (location || ""))}`;

  return capLength(combined, MAX_SLUG_LENGTH);
}

/** Truncate at the last hyphen before `max` so we never cut mid-word. */
function capLength(s: string, max: number): string {
  if (s.length <= max) return s;
  const truncated = s.slice(0, max);
  const lastHyphen = truncated.lastIndexOf("-");
  if (lastHyphen > 0) return truncated.slice(0, lastHyphen);
  return truncated;
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6) || "x";
}

export interface SlugValidationError {
  reason: "empty" | "too_short" | "too_long" | "format" | "reserved";
  message: string;
}

export function validateSlug(s: string): SlugValidationError | null {
  if (!s) return { reason: "empty", message: "Slug is required." };
  if (s.length < MIN_SLUG_LENGTH)
    return { reason: "too_short", message: "Slug must be at least 3 characters." };
  if (s.length > MAX_SLUG_LENGTH)
    return { reason: "too_long", message: `Slug must be ${MAX_SLUG_LENGTH} characters or fewer.` };
  if (!SLUG_PATTERN.test(s))
    return {
      reason: "format",
      message: "Slug must contain only lowercase letters, numbers, and hyphens — no leading/trailing hyphens."
    };
  if (RESERVED_SLUGS.has(s))
    return { reason: "reserved", message: `"${s}" is reserved.` };
  return null;
}

/** Convenience: returns true if the slug passes all validation rules. */
export function isValidSlug(s: string): boolean {
  return validateSlug(s) === null;
}

// ─── Legacy ────────────────────────────────────────────────────────────────

/** @deprecated Use generateSlug(title, location) instead. Kept for any internal callers. */
export function slugify(input: string): string {
  return slugifyText(input).slice(0, 80);
}
