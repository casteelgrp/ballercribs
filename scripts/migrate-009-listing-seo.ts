import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:009` so .env.local is loaded."
    );
  }

  console.log("Running 009 listing-seo migration...");

  // Both nullable — when null, /listings/[slug] generateMetadata falls back to
  // the auto-derived title + description. Admin form exposes them only when
  // the owner wants to hand-tune search snippets on a flagship listing.
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS seo_title TEXT;`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS seo_description TEXT;`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
