import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:010` so .env.local is loaded."
    );
  }

  console.log("Running 010 listing-currency migration...");

  // NOT NULL DEFAULT 'USD' handles the backfill for existing rows atomically —
  // every listing becomes 'USD' on column add (correct for all current rows
  // except Surrey, which is switched to CAD in admin after this ships). The
  // price column itself stays an integer in the listing's native units; the
  // currency column is purely a display hint.
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
