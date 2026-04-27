import { sql } from "@vercel/postgres";

/**
 * blog_redirects — preserves old URLs across slug changes.
 *
 * When an editor renames a slug, the previous slug stays alive as a
 * 308 redirect. External backlinks, internal links in older posts,
 * and Google's index keep working.
 *
 * Schema notes:
 *   - old_slug UNIQUE: the same retired slug can't point to two
 *     places. If an admin really needs to reuse old_slug for a new
 *     post, the create/update path deletes the existing redirect row
 *     first (loop prevention).
 *   - blog_post_id ON DELETE SET NULL: deleting a post doesn't nuke
 *     historical redirects — useful if a post is deleted and replaced
 *     with one inheriting the old URL.
 *   - No is_active column: if a redirect shouldn't fire, delete the row.
 *
 * Indexes: lookup by old_slug (every blog detail miss queries it),
 * plus new_slug for chain flattening when an admin renames again.
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:021` so .env.local is loaded."
    );
  }

  console.log("Running 021 blog-redirects migration...");

  await sql`
    CREATE TABLE IF NOT EXISTS blog_redirects (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      old_slug      TEXT NOT NULL UNIQUE,
      new_slug      TEXT NOT NULL,
      blog_post_id  UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS blog_redirects_old_slug_idx
      ON blog_redirects (old_slug);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS blog_redirects_new_slug_idx
      ON blog_redirects (new_slug);
  `;

  console.log("✓ blog_redirects table + indexes created.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
