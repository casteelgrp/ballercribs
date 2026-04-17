export function formatPrice(cents: number): string {
  if (cents >= 1_000_000_000) {
    return `$${(cents / 1_000_000_000).toFixed(2)}B`;
  }
  if (cents >= 1_000_000) {
    const val = cents / 1_000_000;
    return `$${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (cents >= 1_000) {
    return `$${(cents / 1_000).toFixed(0)}K`;
  }
  return `$${cents.toLocaleString()}`;
}

export function formatSqft(sqft: number | null): string {
  if (!sqft) return "—";
  return `${sqft.toLocaleString()} sq ft`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
