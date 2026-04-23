import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:016` so .env.local is loaded."
    );
  }

  console.log("Running 016 blog-posts migration...");

  // gen_random_uuid() is built-in on Neon Postgres 14+, but this keeps us
  // safe on older / re-created envs.
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

  // ─── post_categories ──────────────────────────────────────────────────
  //
  // Created first so blog_posts can FK to it in the same migration run.
  await sql`
    CREATE TABLE IF NOT EXISTS post_categories (
      slug          TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Seed is idempotent on slug — migration can re-run without double-insert.
  await sql`
    INSERT INTO post_categories (slug, name, description, display_order) VALUES
      ('guides',       'Guides',       'How-tos and insider guides to luxury real estate, rentals, and the BallerCribs world.', 1),
      ('rentals',      'Rentals',      'Mansion rentals, villa roundups, and destination stays — from Mykonos to Malibu.', 2),
      ('case-studies', 'Case Studies', 'Deep dives on properties and deals that defined luxury real estate.', 3),
      ('destinations', 'Destinations', 'Neighborhoods, enclaves, and markets worth knowing.', 4),
      ('news',         'News',         'Transactions, transfers, and moves in the luxury property world.', 5)
    ON CONFLICT (slug) DO NOTHING;
  `;

  // ─── blog_posts ───────────────────────────────────────────────────────
  //
  // id stays UUID (new table, no legacy INTEGER pressure). User FKs are
  // INTEGER to match the existing users.id SERIAL shape. body_json stores
  // the TipTap document; body_html is the rendered output served publicly.
  await sql`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug                TEXT UNIQUE NOT NULL,
      title               TEXT NOT NULL,
      subtitle            TEXT,
      excerpt             TEXT,

      body_json           JSONB,
      body_html           TEXT,

      cover_image_url     TEXT,
      social_cover_url    TEXT,

      meta_title          TEXT,
      meta_description    TEXT,

      category_slug       TEXT NOT NULL,

      is_featured         BOOLEAN NOT NULL DEFAULT FALSE,

      status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'review', 'published', 'archived')),

      submitted_at        TIMESTAMPTZ,
      published_at        TIMESTAMPTZ,
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_reviewed_at    TIMESTAMPTZ,

      author_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,

      reading_time_minutes INTEGER,

      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // FK to post_categories. Guarded by pg_constraint so re-runs skip.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_category_fk'
      ) THEN
        ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_category_fk
          FOREIGN KEY (category_slug) REFERENCES post_categories(slug) ON DELETE RESTRICT;
      END IF;
    END $$;
  `;

  // Indexes — IF NOT EXISTS for clean re-runs.
  await sql`CREATE INDEX IF NOT EXISTS blog_posts_status_idx        ON blog_posts(status);`;
  await sql`CREATE INDEX IF NOT EXISTS blog_posts_category_slug_idx ON blog_posts(category_slug);`;
  await sql`
    CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx
      ON blog_posts(published_at DESC)
      WHERE status = 'published';
  `;

  // Only one featured post at a time (across any status — featured draft
  // still blocks another featured).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_single_featured_idx
      ON blog_posts(is_featured) WHERE is_featured = TRUE;
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
