import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:017` so .env.local is loaded."
    );
  }

  console.log("Running 017 search-tsv migration...");

  // ─── listings.search_tsv ────────────────────────────────────────────────
  //
  // GENERATED STORED column: Postgres recomputes it automatically when
  // any source column changes, so no app-layer write-path code needs to
  // care. Weights follow the title-heavy default (A=1.0, B=0.4, C=0.2,
  // D=0.1) so ts_rank naturally prioritises title/location matches.
  //
  //   A: title, location  (primary identity — "Bel Air" / "Villa Mandalay")
  //   B: agent_name       (common secondary filter)
  //   C: description      (long-form body)
  //
  // agent_brokerage and sale_notes are skipped — they're niche signals
  // that bloat the tsvector without adding much recall. Easy to extend.
  await sql`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS search_tsv tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(location, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(agent_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
      ) STORED;
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS listings_search_tsv_idx
      ON listings USING GIN (search_tsv);
  `;

  // ─── blog_posts.search_tsv ──────────────────────────────────────────────
  //
  // body_html is HTML-stripped inline via regexp_replace before being
  // tokenised — crude but adequate, since to_tsvector normalises
  // whitespace and punctuation anyway. No triggers, no body_text
  // column — Postgres does the work on every write.
  //
  //   A: title
  //   B: subtitle, excerpt
  //   C: body_html (HTML stripped)
  //
  // author_user_id skipped — generated columns can't reference other
  // tables, and a trigger-based author index isn't worth the surface
  // for D5. Park for D6 if "posts by X" ever becomes a real need.
  await sql`
    ALTER TABLE blog_posts
      ADD COLUMN IF NOT EXISTS search_tsv tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
        setweight(
          to_tsvector(
            'english',
            regexp_replace(coalesce(body_html, ''), '<[^>]+>', ' ', 'g')
          ),
          'C'
        )
      ) STORED;
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS blog_posts_search_tsv_idx
      ON blog_posts USING GIN (search_tsv);
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
