import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:014` so .env.local is loaded."
    );
  }

  console.log("Running 014 rental-inquiry-term-preference migration...");

  // Captures the inquirer's stated term intent on /rentals. Nullable so
  // rows that predate this migration don't need backfill — the form
  // makes it required going forward, but older inquiries rendered under
  // the same view should still load.
  //
  // Values: 'short_term' | 'long_term' | 'not_sure'. The "not sure"
  // option is a real answer — we'd rather capture the ambiguity than
  // force someone to guess.
  await sql`ALTER TABLE rental_inquiries ADD COLUMN IF NOT EXISTS rental_term_preference TEXT;`;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rental_inquiries_term_pref_check'
      ) THEN
        ALTER TABLE rental_inquiries ADD CONSTRAINT rental_inquiries_term_pref_check
          CHECK (
            rental_term_preference IS NULL
            OR rental_term_preference IN ('short_term', 'long_term', 'not_sure')
          );
      END IF;
    END $$;
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
