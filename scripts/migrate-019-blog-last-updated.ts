import { sql } from "@vercel/postgres";

/**
 * Adds blog_posts.last_updated_at — editorially-meaningful refresh
 * timestamp distinct from the row's auto-bumped updated_at column
 * (which fires on every save, including typo fixes).
 *
 * Display logic: when last_updated_at is set AND > 24 hours after
 * published_at, the public byline + JSON-LD dateModified + sitemap
 * <lastmod> all reflect the refresh. Otherwise everything falls back
 * to published_at.
 *
 * Nullable, no default. Existing posts get NULL = "never refreshed,
 * use publish date everywhere" — same shape they have today.
 *
 * No index: this column is only read alongside the row, never
 * filtered or sorted on directly.
 *
 * Idempotent via IF NOT EXISTS.
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:019` so .env.local is loaded."
    );
  }

  console.log("Running 019 blog-last-updated migration...");

  await sql`
    ALTER TABLE blog_posts
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;
  `;

  console.log("✓ blog_posts.last_updated_at added (nullable).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
