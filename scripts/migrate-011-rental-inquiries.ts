import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:011` so .env.local is loaded."
    );
  }

  console.log("Running 011 rental-inquiries migration...");

  // ─── rental_inquiries table ──────────────────────────────────────────────
  //
  // SERIAL id + INTEGER status_updated_by intentionally — matches the
  // existing inquiries / agent_inquiries shape and keeps the shared
  // payments.inquiry_id (INTEGER) surface consistent. (The original spec
  // sketched UUID, but that would have forced a divergent payments type
  // or a second nullable column.)
  //
  // Pipeline columns (status / notes / last_contacted_at /
  // status_updated_{at,by}) mirror migration 007 so the unified inbox can
  // read all three inquiry kinds through the same shape.
  await sql`
    CREATE TABLE IF NOT EXISTS rental_inquiries (
      id                SERIAL       PRIMARY KEY,
      name              TEXT         NOT NULL,
      email             TEXT         NOT NULL,
      phone             TEXT,
      destination       TEXT         NOT NULL,
      start_date        DATE,
      end_date          DATE,
      flexible_dates    BOOLEAN      NOT NULL DEFAULT FALSE,
      group_size        INTEGER,
      budget_range      TEXT,
      occasion          TEXT,
      message           TEXT,

      status            TEXT         NOT NULL DEFAULT 'new',
      notes             TEXT,
      last_contacted_at TIMESTAMPTZ,
      status_updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      status_updated_by INTEGER      REFERENCES users(id) ON DELETE SET NULL,
      archived_at       TIMESTAMPTZ,

      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;

  // Status CHECK — idempotent via pg_constraint lookup.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rental_inquiries_status_check'
      ) THEN
        ALTER TABLE rental_inquiries ADD CONSTRAINT rental_inquiries_status_check
          CHECK (status IN ('new', 'working', 'won', 'dead'));
      END IF;
    END $$;
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_rental_inquiries_status ON rental_inquiries(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rental_inquiries_created_at ON rental_inquiries(created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rental_inquiries_archived_at ON rental_inquiries(archived_at);`;

  // ─── payments.inquiry_type CHECK extension ───────────────────────────────
  //
  // Drop the two-value CHECK and re-add with 'rental' included. Idempotent:
  // skip the drop if the constraint already references 'rental', and skip
  // the add if there's already a constraint by this name. Naming convention
  // matches payments.inquiry_type_check set up in migration 008.
  await sql`
    DO $$
    DECLARE
      def TEXT;
    BEGIN
      SELECT pg_get_constraintdef(oid) INTO def
        FROM pg_constraint WHERE conname = 'payments_inquiry_type_check';
      IF def IS NOT NULL AND position('rental' in def) = 0 THEN
        ALTER TABLE payments DROP CONSTRAINT payments_inquiry_type_check;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_inquiry_type_check'
      ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_inquiry_type_check
          CHECK (inquiry_type IN ('buyer_lead', 'agent_feature', 'rental'));
      END IF;
    END $$;
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
