import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:005` so .env.local is loaded."
    );
  }

  console.log("Running 005 inquiries-archive migration...");

  // Nullable timestamp — NULL = active, any value = archived + timestamp.
  // Boolean would work but TIMESTAMPTZ gives us 'when' for free.
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;

  await sql`CREATE INDEX IF NOT EXISTS idx_inquiries_archived_at ON inquiries(archived_at);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_inquiries_archived_at ON agent_inquiries(archived_at);`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
