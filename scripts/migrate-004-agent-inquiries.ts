import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:004` so .env.local is loaded."
    );
  }

  console.log("Running 004 agent-inquiries migration...");

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

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
