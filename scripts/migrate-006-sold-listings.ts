import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:006` so .env.local is loaded."
    );
  }

  console.log("Running 006 sold-listings migration...");

  // Nullable timestamps — same pattern as archived_at / submitted_at.
  // NULL sold_at = active, any value = sold at that moment.
  // sold_price_usd nullable so "SOLD · Price undisclosed" is representable (NDA / off-market).
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ NULL;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_price_usd BIGINT NULL;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS sale_notes TEXT NULL;`;

  // last_reviewed_at drives the 90-day "still active?" confirmation loop on the
  // admin dashboard — a listing reappears in the stale queue only 90 days after
  // the last review tap.
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ NULL;`;

  await sql`CREATE INDEX IF NOT EXISTS idx_listings_sold_at ON listings(sold_at);`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
