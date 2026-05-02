import { sql } from "@vercel/postgres";

/**
 * D10 Commit 1 — destinations.
 *
 * Adds:
 *   - destinations table (slug, name, display_name, region, blurb,
 *     hero image, SEO overrides, published toggle)
 *   - listings.destination_id  (nullable FK, ON DELETE SET NULL)
 *   - blog_posts.destination_id (nullable FK, ON DELETE SET NULL)
 *
 * Destinations are wayfinding labels (Malibu, The Hamptons, Lake
 * Como) — flat, no country/state hierarchy. listings + blog_posts FKs
 * are nullable on purpose so existing rows pass through unchanged and
 * tagging is opt-in. ON DELETE SET NULL means deleting a destination
 * untags its content rather than blocking the delete.
 *
 * No backfill — every FK column starts NULL.
 *
 * Run with: npm run migrate:023
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:023` so .env.local is loaded."
    );
  }

  console.log("Running 023 destinations migration...");

  // ─── destinations table ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS destinations (
      id              SERIAL PRIMARY KEY,
      slug            TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      display_name    TEXT NOT NULL,
      region          TEXT,
      blurb           TEXT,
      hero_image_url  TEXT,
      hero_image_alt  TEXT,
      seo_title       TEXT,
      seo_description TEXT,
      published       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Partial — public surfaces only ever read published rows; admin
  // reads the full table directly via a sequential scan over a small
  // table, which is fine.
  await sql`
    CREATE INDEX IF NOT EXISTS destinations_published_idx
      ON destinations (published) WHERE published = TRUE;
  `;

  // ─── listings.destination_id ───────────────────────────────────────────
  //
  // ON DELETE SET NULL: deleting a destination untags listings rather
  // than cascading deletes (the warning in /admin/destinations/[id]/edit
  // makes the contract explicit to admins).
  await sql`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS destination_id INTEGER
        REFERENCES destinations(id) ON DELETE SET NULL;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listings_destination_id_idx
      ON listings (destination_id) WHERE destination_id IS NOT NULL;
  `;

  // ─── blog_posts.destination_id ─────────────────────────────────────────
  //
  // Same ON DELETE SET NULL rule. Only posts with category_slug =
  // 'destinations' get the dropdown in the admin form (D10 commit 2),
  // but the column itself is unconditional — no DB-side constraint
  // tying destination_id to category_slug, since changing categories
  // is a normal edit flow and the app layer clears destination_id
  // when a post leaves the Destinations category.
  await sql`
    ALTER TABLE blog_posts
      ADD COLUMN IF NOT EXISTS destination_id INTEGER
        REFERENCES destinations(id) ON DELETE SET NULL;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS blog_posts_destination_id_idx
      ON blog_posts (destination_id) WHERE destination_id IS NOT NULL;
  `;

  console.log("✓ destinations table created.");
  console.log("✓ listings + blog_posts extended with destination_id.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
