import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run db:init` so .env.local is loaded, " +
        "or source it manually with `set -a && source .env.local && set +a`."
    );
  }

  console.log("Creating tables...");

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
      agent_name TEXT,
      agent_brokerage TEXT,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      published BOOLEAN NOT NULL DEFAULT TRUE,
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
  await sql`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL;
  `;
  await sql`CREATE INDEX IF NOT EXISTS listings_created_by_idx ON listings (created_by_user_id);`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
