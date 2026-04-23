/**
 * Seed a role='user' test account for permission testing.
 *
 * Idempotent — re-running won't duplicate. If the account already exists
 * with a different password, the password is refreshed from the env var
 * so you don't have to delete-and-reinsert when rotating the test creds.
 *
 * Usage:
 *   # in .env.local
 *   TEST_USER_PASSWORD=<pick something local-only>
 *
 *   npm run seed:test-user
 *
 * We never echo the password — only the email lands in stdout so you know
 * which account to log in with.
 */
import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";
import { BCRYPT_COST } from "../src/lib/auth";

const TEST_EMAIL = "test-user@ballercribs.local";
const TEST_NAME = "Test User";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run seed:test-user` so .env.local is loaded."
    );
  }
  const rawPassword = process.env.TEST_USER_PASSWORD;
  if (!rawPassword || rawPassword.length < 8) {
    throw new Error(
      "TEST_USER_PASSWORD is not set or too short (min 8 chars). Add it to .env.local."
    );
  }

  const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_COST);

  // UPSERT-style via ON CONFLICT. Refreshes the hash on every run so
  // rotating TEST_USER_PASSWORD in .env.local takes effect without a
  // manual delete-and-reinsert.
  await sql`
    INSERT INTO users (email, name, role, password_hash, is_active, must_change_password)
    VALUES (${TEST_EMAIL}, ${TEST_NAME}, 'user', ${passwordHash}, TRUE, FALSE)
    ON CONFLICT (email) DO UPDATE SET
      password_hash        = EXCLUDED.password_hash,
      name                 = EXCLUDED.name,
      role                 = EXCLUDED.role,
      is_active            = EXCLUDED.is_active,
      must_change_password = EXCLUDED.must_change_password;
  `;

  console.log(`Seeded test user: ${TEST_EMAIL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
