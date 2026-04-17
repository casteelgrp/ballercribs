import { sql } from "@vercel/postgres";

async function main() {
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

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
