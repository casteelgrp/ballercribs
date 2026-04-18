import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:003` so .env.local is loaded."
    );
  }

  console.log("Running 003 hero-photos migration...");

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

  // Partial index — homepage queries only fetch active rows.
  await sql`
    CREATE INDEX IF NOT EXISTS hero_photos_active_order_idx
      ON hero_photos (active, display_order)
      WHERE active = TRUE;
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
