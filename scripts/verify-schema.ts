import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set; run via the npm script.");
  }

  console.log("\n── users columns ──");
  const usersCols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `;
  console.table(usersCols.rows);

  console.log("\n── listings.created_by_user_id ──");
  const listingsCol = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'created_by_user_id';
  `;
  console.table(listingsCol.rows);

  console.log("\n── foreign keys on listings ──");
  const fks = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'listings'::regclass AND contype = 'f';
  `;
  console.table(fks.rows);

  console.log("\n── check constraints on users ──");
  const checks = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c';
  `;
  console.table(checks.rows);

  console.log("\n── indexes on users + listings ──");
  const idx = await sql`
    SELECT tablename, indexname FROM pg_indexes
    WHERE tablename IN ('users', 'listings')
    ORDER BY tablename, indexname;
  `;
  console.table(idx.rows);

  console.log("\n── user count ──");
  const count = await sql`SELECT COUNT(*)::int AS n FROM users;`;
  console.log("users:", count.rows[0].n);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
