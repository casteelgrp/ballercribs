import { sql } from "@vercel/postgres";
import type {
  AdminSearchResults,
  SearchBlogPost,
  SearchListing,
  SearchResult
} from "@/types/search";
import type { ListingStatus, ListingType } from "./types";
import type { PostStatus } from "@/types/blog";

// ─── Row mappers ───────────────────────────────────────────────────────────

function rowToListing(row: any): SearchListing {
  return {
    kind: "listing",
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    location: row.location,
    listingType: (row.listing_type ?? "sale") as ListingType,
    status: row.status as ListingStatus,
    soldAt: row.sold_at ? new Date(row.sold_at) : null,
    heroImageUrl: row.hero_image_url ?? null,
    snippet: row.snippet ?? "",
    rank: Number(row.rank ?? 0)
  };
}

function rowToBlog(row: any): SearchBlogPost {
  return {
    kind: "blog",
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? null,
    status: row.status as PostStatus,
    coverImageUrl: row.cover_image_url ?? null,
    categorySlug: row.category_slug,
    snippet: row.snippet ?? "",
    rank: Number(row.rank ?? 0)
  };
}

// ─── Snippet config ────────────────────────────────────────────────────────
//
// `ts_headline` builds an excerpt around the match. Empty Start/StopSel
// return plain text — we wrap the values in double quotes so Postgres
// parses them as explicit empty strings rather than inferring the
// following comma as a literal marker (that's what produced "," wraps
// around matched words during early testing). MaxWords/MinWords shape
// the snippet length; ShortWord avoids burning budget on articles
// ("a", "the") inside the excerpt.
const HEADLINE_OPTS =
  'StartSel="",StopSel="",MaxWords=24,MinWords=10,ShortWord=3';

// ─── Admin search ──────────────────────────────────────────────────────────
//
// All statuses, both content types, grouped by kind. Top-N per bucket
// keeps the dropdown UI bounded; the full-results page can re-query
// with a higher limit. plainto_tsquery safely handles arbitrary user
// input (space-separated words → implicit AND, punctuation ignored).

export async function searchAdmin(
  query: string,
  opts: { limit?: number } = {}
): Promise<AdminSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) return { listings: [], blogs: [] };
  const limit = Math.min(Math.max(1, opts.limit ?? 5), 50);

  const [listingsRes, blogsRes] = await Promise.all([
    sql`
      SELECT
        l.id, l.slug, l.title, l.location, l.listing_type, l.status,
        l.sold_at, l.hero_image_url,
        ts_headline('english', coalesce(l.description, ''), q, ${HEADLINE_OPTS}) AS snippet,
        ts_rank(l.search_tsv, q) AS rank
      FROM listings l, plainto_tsquery('english', ${trimmed}) q
      WHERE l.search_tsv @@ q
      ORDER BY rank DESC, l.updated_at DESC
      LIMIT ${limit};
    `,
    sql`
      SELECT
        b.id, b.slug, b.title, b.excerpt, b.status, b.cover_image_url,
        b.category_slug,
        ts_headline(
          'english',
          regexp_replace(coalesce(b.body_html, ''), '<[^>]+>', ' ', 'g'),
          q,
          ${HEADLINE_OPTS}
        ) AS snippet,
        ts_rank(b.search_tsv, q) AS rank
      FROM blog_posts b, plainto_tsquery('english', ${trimmed}) q
      WHERE b.search_tsv @@ q
      ORDER BY rank DESC, b.updated_at DESC
      LIMIT ${limit};
    `
  ]);

  return {
    listings: listingsRes.rows.map(rowToListing),
    blogs: blogsRes.rows.map(rowToBlog)
  };
}

// ─── Public search ─────────────────────────────────────────────────────────
//
// Published only. Listings: status='published' — sold listings
// included (they're still live at /listings/{slug} with a Sold badge,
// and users searching by address should find them). Blog posts:
// status='published' strictly.
//
// Results are a single flat ranked array — the /search page is an
// all-content view where relevance wins over type grouping. UI adds a
// kind badge per card.

export async function searchPublic(
  query: string,
  opts: { limit?: number } = {}
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const limit = Math.min(Math.max(1, opts.limit ?? 20), 100);

  // Two SELECTs tagged with a `kind` literal then UNION ALL — same
  // shape in each branch so the result set is a single sorted list.
  // The two branches have slightly different column sets so we project
  // each to the union shape (with NULL fills) and sort across kinds.
  const { rows } = await sql`
    (
      SELECT
        'listing'::text                  AS kind,
        l.id::text                        AS id,
        l.slug                            AS slug,
        l.title                           AS title,
        l.location                        AS location,
        l.listing_type                    AS listing_type,
        l.status                          AS status,
        l.sold_at                         AS sold_at,
        l.hero_image_url                  AS hero_image_url,
        NULL::text                        AS excerpt,
        NULL::text                        AS cover_image_url,
        NULL::text                        AS category_slug,
        ts_headline('english', coalesce(l.description, ''), q, ${HEADLINE_OPTS}) AS snippet,
        ts_rank(l.search_tsv, q)          AS rank
      FROM listings l, plainto_tsquery('english', ${trimmed}) q
      WHERE l.search_tsv @@ q AND l.status = 'published'
    )
    UNION ALL
    (
      SELECT
        'blog'::text                       AS kind,
        b.id::text                         AS id,
        b.slug                             AS slug,
        b.title                            AS title,
        NULL::text                         AS location,
        NULL::text                         AS listing_type,
        b.status                           AS status,
        NULL::timestamptz                  AS sold_at,
        NULL::text                         AS hero_image_url,
        b.excerpt                          AS excerpt,
        b.cover_image_url                  AS cover_image_url,
        b.category_slug                    AS category_slug,
        ts_headline(
          'english',
          regexp_replace(coalesce(b.body_html, ''), '<[^>]+>', ' ', 'g'),
          q,
          ${HEADLINE_OPTS}
        ) AS snippet,
        ts_rank(b.search_tsv, q)           AS rank
      FROM blog_posts b, plainto_tsquery('english', ${trimmed}) q
      WHERE b.search_tsv @@ q AND b.status = 'published'
    )
    ORDER BY rank DESC
    LIMIT ${limit};
  `;

  return rows.map((row: any): SearchResult => {
    if (row.kind === "listing") return rowToListing(row);
    return rowToBlog(row);
  });
}
