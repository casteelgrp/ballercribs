import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:users` so .env.local is loaded, " +
        "or source it manually with `set -a && source .env.local && set +a`."
    );
  }

  console.log("Running user-system migration...");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id                    SERIAL        PRIMARY KEY,
      email                 TEXT          UNIQUE NOT NULL,
      password_hash         TEXT          NOT NULL,
      name                  TEXT          NOT NULL,
      role                  TEXT          NOT NULL CHECK (role IN ('owner', 'user')),
      is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
      must_change_password  BOOLEAN       NOT NULL DEFAULT FALSE,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      last_login_at         TIMESTAMPTZ
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);`;

  await sql`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL;
  `;

  await sql`CREATE INDEX IF NOT EXISTS listings_created_by_idx ON listings (created_by_user_id);`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
