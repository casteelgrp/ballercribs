import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:013` so .env.local is loaded."
    );
  }

  console.log("Running 013 rental-inquiry-listing-link migration...");

  // Link rental inquiries back to the rental listing that triggered them.
  // Both columns nullable — organic inquiries from /rentals without a
  // property pre-fill will still land as NULL. listing_id is INTEGER to
  // match listings.id (SERIAL); listing_slug is kept alongside so the
  // admin row renders correctly even if the referenced listing is later
  // unpublished or deleted (ON DELETE SET NULL handles the FK side).
  await sql`
    ALTER TABLE rental_inquiries
    ADD COLUMN IF NOT EXISTS listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL;
  `;
  await sql`ALTER TABLE rental_inquiries ADD COLUMN IF NOT EXISTS listing_slug TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rental_inquiries_listing_id ON rental_inquiries(listing_id);`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
