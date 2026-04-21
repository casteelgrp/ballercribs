import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:007` so .env.local is loaded."
    );
  }

  console.log("Running 007 inquiry-status migration...");

  // ─── Buyer inquiries ───────────────────────────────────────────────────────
  //
  // Idempotent shape: every column add uses IF NOT EXISTS. The status backfill
  // that marks already-archived rows as 'dead' is guarded by status = 'new'
  // so a re-run against rows already moved through the pipeline (e.g. a
  // working deal that got archived) doesn't regress them back to 'dead'.

  console.log("  inquiries: adding status pipeline columns...");

  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';`;
  await sql`UPDATE inquiries SET status = 'dead' WHERE archived_at IS NOT NULL AND status = 'new';`;

  // CHECK constraint — idempotent via pg_constraint lookup since
  // `ADD CONSTRAINT IF NOT EXISTS` isn't supported on constraints.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inquiries_status_check'
      ) THEN
        ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check
          CHECK (status IN ('new', 'working', 'won', 'dead'));
      END IF;
    END $$;
  `;

  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS notes TEXT;`;
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);`;

  // ─── Agent inquiries ───────────────────────────────────────────────────────

  console.log("  agent_inquiries: adding status pipeline columns...");

  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';`;
  await sql`UPDATE agent_inquiries SET status = 'dead' WHERE archived_at IS NOT NULL AND status = 'new';`;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_inquiries_status_check'
      ) THEN
        ALTER TABLE agent_inquiries ADD CONSTRAINT agent_inquiries_status_check
          CHECK (status IN ('new', 'working', 'won', 'dead'));
      END IF;
    END $$;
  `;

  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS notes TEXT;`;
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS status_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_inquiries_status ON agent_inquiries(status);`;

  // Tier — agent-only, nullable, no backfill. Future Square checkout will
  // write '1500' / '3750' / '5000' / 'custom'; the admin UI maps those to
  // "$1.5K / $3.75K / $5K / CUSTOM" badges and renders nothing when null.
  console.log("  agent_inquiries: adding tier column...");
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS tier TEXT;`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
