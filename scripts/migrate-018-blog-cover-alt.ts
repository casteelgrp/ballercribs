import { sql } from "@vercel/postgres";

/**
 * Adds blog_posts.cover_image_alt — accessibility text for the cover
 * image distinct from post.title. Populated by the editor, surfaces as
 * the <img alt> on the public detail/list/featured hero, og:image:alt
 * for socials, and ImageObject.description in the post JSON-LD.
 *
 * Nullable, no default. Existing rows get NULL; the public render falls
 * back to post.title in that case so nothing visibly regresses for
 * already-published posts.
 *
 * IMPORTANT: idempotent via IF NOT EXISTS so re-running on a partially-
 * migrated environment doesn't error.
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:018` so .env.local is loaded."
    );
  }

  console.log("Running 018 blog-cover-alt migration...");

  await sql`
    ALTER TABLE blog_posts
    ADD COLUMN IF NOT EXISTS cover_image_alt TEXT;
  `;

  console.log("✓ blog_posts.cover_image_alt added (nullable).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
