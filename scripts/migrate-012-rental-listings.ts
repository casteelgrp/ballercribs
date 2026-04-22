import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:012` so .env.local is loaded."
    );
  }

  console.log("Running 012 rental-listings migration...");

  // ─── listing_type ────────────────────────────────────────────────────────
  //
  // Nullable-add with DEFAULT 'sale' so every existing row lands on 'sale'
  // in one step — accurate because no rental listings exist yet. CHECK
  // constraint is guarded by pg_constraint lookup (idempotent re-run).
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'sale';`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'listings_listing_type_check'
      ) THEN
        ALTER TABLE listings ADD CONSTRAINT listings_listing_type_check
          CHECK (listing_type IN ('sale', 'rental'));
      END IF;
    END $$;
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON listings(listing_type);`;

  // ─── Rental-specific fields ─────────────────────────────────────────────
  //
  // All nullable — only populated when listing_type = 'rental'. App-layer
  // validation enforces cross-field rules (term='short_term' → unit in
  // ('night','week'); term='long_term' → unit='month'). Keeping this at
  // the app layer rather than a multi-column CHECK so we can tune the rule
  // without another migration as the product evolves.
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_term TEXT;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_price_cents BIGINT;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_price_unit TEXT;`;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'listings_rental_term_check'
      ) THEN
        ALTER TABLE listings ADD CONSTRAINT listings_rental_term_check
          CHECK (rental_term IS NULL OR rental_term IN ('short_term', 'long_term'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'listings_rental_price_unit_check'
      ) THEN
        ALTER TABLE listings ADD CONSTRAINT listings_rental_price_unit_check
          CHECK (rental_price_unit IS NULL OR rental_price_unit IN ('night', 'week', 'month'));
      END IF;
    END $$;
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
