import { sql } from "@vercel/postgres";

/**
 * Backfill cleanup for orphaned author/creator FKs.
 *
 * Before de80b16 shipped, deleting a user nulled out their content's
 * author/creator FKs via the existing ON DELETE SET NULL constraints.
 * Listings, blog posts, and payments authored by the deleted user
 * surface publicly with "by —" or NULL attribution. Post-de80b16,
 * the DELETE handler reattributes content to the deleting admin so
 * this never happens going forward — but pre-de80b16 deletions left
 * orphans behind that this script fixes.
 *
 * What it does: sweeps three tables, finds rows where the author/
 * creator FK is NULL, and points them all at the specified owner.
 * Idempotent — only touches NULL rows, so re-running is a no-op.
 *
 * What it doesn't touch: audit-trail FKs (reviewed_by_user_id on
 * listings/blog_posts, status_updated_by on the inquiry tables).
 * Those stay NULL when their original actor was deleted — rewriting
 * historical events to a different actor would falsify the record.
 *
 * Usage: npm run reattribute:orphaned -- <owner-email>
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run reattribute:orphaned -- <owner-email>` so .env.local is loaded."
    );
  }

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run reattribute:orphaned -- <owner-email>");
    console.error("");
    console.error(
      "Reattributes orphaned listings, blog posts, and payments"
    );
    console.error("(rows with NULL author/creator FK) to the specified owner.");
    console.error("Idempotent — safe to re-run.");
    process.exit(1);
  }

  // Resolve email → user, validate role. Owner-only because pre-
  // delete content always originates from owners or admin-elevated
  // accounts; reattributing orphans to a non-owner would be a
  // surprising blast radius for a one-shot cleanup.
  const userRes = await sql`
    SELECT id, role, name, email FROM users
    WHERE email = ${email}
    LIMIT 1;
  `;
  const target = userRes.rows[0];
  if (!target) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }
  if (target.role !== "owner") {
    console.error(
      `User ${email} has role '${target.role}' — must be 'owner'. Aborting.`
    );
    process.exit(1);
  }

  const targetId = Number(target.id);
  console.log(
    `Reattributing orphaned content to ${target.name} <${target.email}> (id ${targetId})...`
  );

  const listingsRes = await sql`
    UPDATE listings
    SET created_by_user_id = ${targetId}
    WHERE created_by_user_id IS NULL;
  `;
  const postsRes = await sql`
    UPDATE blog_posts
    SET author_user_id = ${targetId}
    WHERE author_user_id IS NULL;
  `;
  const paymentsRes = await sql`
    UPDATE payments
    SET created_by_user_id = ${targetId}
    WHERE created_by_user_id IS NULL;
  `;

  console.log(`✓ listings:    ${listingsRes.rowCount ?? 0} reattributed`);
  console.log(`✓ blog posts:  ${postsRes.rowCount ?? 0} reattributed`);
  console.log(`✓ payments:    ${paymentsRes.rowCount ?? 0} reattributed`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
