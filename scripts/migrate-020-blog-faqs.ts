import { sql } from "@vercel/postgres";

/**
 * Adds blog_posts.faqs — a structured array of {question, answer}
 * objects, distinct from body content. Drives:
 *   - The "Frequently Asked Questions" section on the public post page
 *   - FAQPage JSON-LD schema for Google's FAQ rich result
 *
 * JSONB instead of a side table because FAQs are tightly coupled to
 * one post, never queried independently, and never join. Default NULL
 * (not []) so the public render's existence check stays a clean
 * `post.faqs && post.faqs.length > 0`.
 *
 * No backfill — every existing post stays NULL. Authors add FAQs to
 * existing posts manually via the admin form when relevant.
 *
 * Idempotent via IF NOT EXISTS.
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:020` so .env.local is loaded."
    );
  }

  console.log("Running 020 blog-faqs migration...");

  await sql`
    ALTER TABLE blog_posts
    ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT NULL;
  `;

  console.log("✓ blog_posts.faqs added (JSONB, nullable).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
