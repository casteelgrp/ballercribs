import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:002` so .env.local is loaded."
    );
  }

  console.log("Running 002 gallery + workflow migration...");

  // ── Part 1: workflow status ────────────────────────────────────────────
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'listings'::regclass AND conname = 'listings_status_check'
      ) THEN
        ALTER TABLE listings ADD CONSTRAINT listings_status_check
          CHECK (status IN ('draft', 'review', 'published', 'archived'));
      END IF;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'listings' AND column_name = 'published'
      ) THEN
        UPDATE listings SET status = 'published'
          WHERE published = TRUE AND status = 'draft';
        UPDATE listings SET published_at = updated_at
          WHERE status = 'published' AND published_at IS NULL;
        ALTER TABLE listings DROP COLUMN published;
      END IF;
    END $$;
  `;

  await sql`CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);`;

  // ── Part 2: gallery structure ──────────────────────────────────────────
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS social_cover_url TEXT;`;

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM listings
        WHERE gallery_image_urls IS NOT NULL
          AND jsonb_typeof(gallery_image_urls) = 'array'
          AND jsonb_array_length(gallery_image_urls) > 0
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(gallery_image_urls) e
            WHERE jsonb_typeof(e) = 'string'
          )
      ) THEN
        UPDATE listings
        SET gallery_image_urls = (
          SELECT jsonb_agg(
            CASE jsonb_typeof(elem)
              WHEN 'string' THEN jsonb_build_object('url', elem #>> '{}', 'caption', NULL)
              ELSE elem
            END
          )
          FROM jsonb_array_elements(gallery_image_urls) elem
        )
        WHERE gallery_image_urls IS NOT NULL
          AND jsonb_typeof(gallery_image_urls) = 'array'
          AND jsonb_array_length(gallery_image_urls) > 0;
      END IF;
    END $$;
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
