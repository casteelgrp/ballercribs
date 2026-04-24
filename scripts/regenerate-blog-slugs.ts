/**
 * One-off: regenerate existing blog_posts.slug from title using the new
 * generateBlogSlug helper. Idempotent — only rewrites rows whose current
 * slug differs from the freshly generated one.
 *
 * Why run:
 *   - generateSlug was tuned for listings (stopword + keyword-cap
 *     filter) and produced lossy slugs for blog titles (e.g. "Herschel
 *     Supply Enters the Golf World With First Collection" became
 *     "herschel-supply-enters"). Switching blog to generateBlogSlug
 *     fixes new inserts; this script brings existing rows to parity.
 *   - Site is pre-launch (no production domain, nothing indexed), so
 *     changing slugs has no SEO cost.
 *
 * Conflict handling:
 *   - If the freshly generated slug already exists on a DIFFERENT post,
 *     appends -2, -3, etc until unique. Same pattern as uniqueSlug() in
 *     src/lib/blog-queries.ts. Each candidate check uses an
 *     id-excluded query so a row can always take its own ideal slug.
 *
 * Output: per-row log of "kept" / "renamed old → new". No-op when every
 * row is already at the ideal slug (safe to re-run).
 */
import { sql } from "@vercel/postgres";
import { generateBlogSlug } from "../src/lib/format";

async function nextAvailableSlug(
  candidate: string,
  excludeId: string
): Promise<string> {
  let attempt = candidate;
  let suffix = 1;
  while (true) {
    const { rows } = await sql`
      SELECT 1 FROM blog_posts
      WHERE slug = ${attempt} AND id != ${excludeId}::uuid
      LIMIT 1;
    `;
    if (rows.length === 0) return attempt;
    suffix += 1;
    attempt = `${candidate}-${suffix}`;
  }
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run regenerate:blog-slugs` so .env.local is loaded."
    );
  }

  const { rows } = await sql`
    SELECT id, slug, title FROM blog_posts ORDER BY created_at ASC;
  `;

  if (rows.length === 0) {
    console.log("No blog posts found — nothing to do.");
    return;
  }

  let renamed = 0;
  let kept = 0;

  for (const row of rows) {
    const id = String(row.id);
    const current = row.slug as string;
    const title = row.title as string;

    const ideal = generateBlogSlug(title);
    if (!ideal) {
      console.warn(`  ! ${id}: empty slug produced from title="${title}" — skipping`);
      continue;
    }
    if (ideal === current) {
      kept += 1;
      continue;
    }

    const final = await nextAvailableSlug(ideal, id);
    await sql`
      UPDATE blog_posts
      SET slug = ${final}, updated_at = NOW()
      WHERE id = ${id}::uuid;
    `;
    console.log(`  ~ ${current}  →  ${final}`);
    renamed += 1;
  }

  console.log(
    `\nDone. ${renamed} slug(s) regenerated, ${kept} already at ideal shape.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
