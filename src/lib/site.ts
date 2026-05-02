/**
 * Single source of truth for the site's canonical origin.
 *
 * Every callsite that reaches for `process.env.NEXT_PUBLIC_SITE_URL`
 * with the same `"https://ballercribs.vercel.app"` fallback should
 * import `getSiteUrl()` instead — keeps the fallback in one place so
 * the launch-day flip to ballercribs.com is a one-env-var change.
 *
 * `isProductionHost` is paired here for the same reason: middleware /
 * robots / canonical logic that needs to gate behavior on the public
 * production hostname has one helper to call. No callers today —
 * shipped now so it's there when the domain lands.
 */

const FALLBACK_SITE_URL = "https://ballercribs.vercel.app";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL;
}

/**
 * True when `host` is the production apex or a subdomain of it.
 * Intended for middleware/robots gating once ballercribs.com is
 * pointed at the project — `Host` headers can carry ports, so callers
 * should strip those before passing in if relevant.
 */
export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host === "ballercribs.com" || host.endsWith(".ballercribs.com");
}
