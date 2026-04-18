import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run db:init` so .env.local is loaded, " +
        "or source it manually with `set -a && source .env.local && set +a`."
    );
  }

  console.log("Bringing schema to current version...");

  // Listings — fresh DB gets v3 shape directly. Existing DBs keep their table
  // (IF NOT EXISTS skips), and the ALTERs below back-fill missing columns.
  await sql`
    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      price_usd BIGINT NOT NULL,
      bedrooms INTEGER,
      bathrooms NUMERIC(4,1),
      square_feet INTEGER,
      description TEXT NOT NULL,
      hero_image_url TEXT NOT NULL,
      gallery_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      social_cover_url TEXT,
      agent_name TEXT,
      agent_brokerage TEXT,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
      submitted_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inquiries (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT,
      pre_approved BOOLEAN NOT NULL DEFAULT FALSE,
      timeline TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS listings_slug_idx ON listings(slug);`;
  await sql`CREATE INDEX IF NOT EXISTS listings_featured_idx ON listings(featured) WHERE featured = TRUE;`;
  await sql`CREATE INDEX IF NOT EXISTS inquiries_listing_idx ON inquiries(listing_id);`;
  await sql`CREATE INDEX IF NOT EXISTS inquiries_created_idx ON inquiries(created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);`;

  // Users
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id                    SERIAL        PRIMARY KEY,
      email                 TEXT          UNIQUE NOT NULL,
      password_hash         TEXT          NOT NULL,
      name                  TEXT          NOT NULL,
      role                  TEXT          NOT NULL CHECK (role IN ('owner', 'user')),
      is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
      must_change_password  BOOLEAN       NOT NULL DEFAULT FALSE,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      last_login_at         TIMESTAMPTZ
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);`;

  // Workflow + gallery columns on existing listings tables (v1/v2 → v3 upgrade path).
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS listings_created_by_idx ON listings(created_by_user_id);`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS social_cover_url TEXT;`;

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

  // v1 → v3 backfill: published BOOLEAN -> status TEXT
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'listings' AND column_name = 'published'
      ) THEN
        UPDATE listings SET status = 'published' WHERE published = TRUE AND status = 'draft';
        UPDATE listings SET published_at = updated_at WHERE status = 'published' AND published_at IS NULL;
        ALTER TABLE listings DROP COLUMN published;
      END IF;
    END $$;
  `;

  // v1/v2 → v3 backfill: gallery_image_urls string[] -> {url, caption}[]
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM listings
        WHERE gallery_image_urls IS NOT NULL
          AND jsonb_typeof(gallery_image_urls) = 'array'
          AND jsonb_array_length(gallery_image_urls) > 0
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(gallery_image_urls) e WHERE jsonb_typeof(e) = 'string')
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

  // Hero photos (migration 003).
  await sql`
    CREATE TABLE IF NOT EXISTS hero_photos (
      id            SERIAL        PRIMARY KEY,
      url           TEXT          NOT NULL,
      caption       TEXT,
      display_order INTEGER       NOT NULL DEFAULT 0,
      active        BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS hero_photos_active_order_idx
      ON hero_photos (active, display_order)
      WHERE active = TRUE;
  `;

  // Agent inquiries (migration 004).
  await sql`
    CREATE TABLE IF NOT EXISTS agent_inquiries (
      id            SERIAL        PRIMARY KEY,
      name          TEXT          NOT NULL,
      email         TEXT          NOT NULL,
      phone         TEXT,
      brokerage     TEXT,
      city_state    TEXT,
      inquiry_type  TEXT          NOT NULL CHECK (inquiry_type IN ('featured', 'referral', 'other')),
      message       TEXT,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS agent_inquiries_created_idx ON agent_inquiries (created_at DESC);
  `;

  // Archive column + index for inquiries and agent_inquiries (migration 005).
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inquiries_archived_at ON inquiries(archived_at);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_inquiries_archived_at ON agent_inquiries(archived_at);`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
