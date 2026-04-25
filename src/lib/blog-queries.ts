import { sql } from "@vercel/postgres";
import type {
  BlogPost,
  BlogPostListItem,
  CreatePostInput,
  PostCategory,
  PostStatus,
  UpdatePostInput
} from "@/types/blog";
import { generateBlogSlug } from "./format";

// ─── Row mappers ───────────────────────────────────────────────────────────
//
// Match the shape used across src/lib/db.ts — pull raw rows out of the
// Postgres driver and normalize them into strictly-typed objects. Numeric
// columns are coerced with Number() because @vercel/postgres surfaces
// BIGINT/INTEGER as strings in some configurations.

function rowToBlogPost(row: any): BlogPost {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? null,
    excerpt: row.excerpt ?? null,
    bodyJson: row.body_json ?? null,
    bodyHtml: row.body_html ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    coverImageAlt: row.cover_image_alt ?? null,
    socialCoverUrl: row.social_cover_url ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    categorySlug: row.category_slug,
    isFeatured: Boolean(row.is_featured),
    status: row.status as PostStatus,
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    reviewedByUserId:
      row.reviewed_by_user_id !== null && row.reviewed_by_user_id !== undefined
        ? Number(row.reviewed_by_user_id)
        : null,
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at) : null,
    authorUserId:
      row.author_user_id !== null && row.author_user_id !== undefined
        ? Number(row.author_user_id)
        : null,
    readingTimeMinutes:
      row.reading_time_minutes !== null && row.reading_time_minutes !== undefined
        ? Number(row.reading_time_minutes)
        : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function rowToListItem(row: any): BlogPostListItem {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? null,
    excerpt: row.excerpt ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    coverImageAlt: row.cover_image_alt ?? null,
    categorySlug: row.category_slug,
    isFeatured: Boolean(row.is_featured),
    status: row.status as PostStatus,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    readingTimeMinutes:
      row.reading_time_minutes !== null && row.reading_time_minutes !== undefined
        ? Number(row.reading_time_minutes)
        : null,
    authorUserId:
      row.author_user_id !== null && row.author_user_id !== undefined
        ? Number(row.author_user_id)
        : null
  };
}

function rowToCategory(row: any): PostCategory {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    displayOrder: Number(row.display_order)
  };
}

// ─── Reading time ──────────────────────────────────────────────────────────
//
// Walk a TipTap JSON document and sum up text-node word counts. 225 wpm is
// Medium's long-time convention and hits the right "feels about right"
// middle for narrative prose. Minimum one minute so a one-paragraph post
// doesn't report "0 min read".

const WORDS_PER_MINUTE = 225;

function collectText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof n.text === "string") out.push(n.text);
  if (Array.isArray(n.content)) {
    for (const child of n.content) collectText(child, out);
  }
}

export function computeReadingTimeMinutes(bodyJson: unknown): number {
  const parts: string[] = [];
  collectText(bodyJson, parts);
  const words = parts.join(" ").trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// ─── Public reads ──────────────────────────────────────────────────────────

/**
 * Published posts for the public /blog index, optionally filtered by
 * category and paginated. Ordering is newest-published first — undefined
 * published_at is impossible for status='published' in practice (publishPost
 * stamps it), but we coalesce to created_at defensively.
 */
export async function getPublishedPosts(opts?: {
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<BlogPostListItem[]> {
  const limit = opts?.limit ?? 12;
  const offset = opts?.offset ?? 0;

  if (opts?.category) {
    const { rows } = await sql`
      SELECT id, slug, title, subtitle, excerpt, cover_image_url, cover_image_alt,
             category_slug, is_featured, status, published_at,
             reading_time_minutes, author_user_id
      FROM blog_posts
      WHERE status = 'published' AND category_slug = ${opts.category}
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return rows.map(rowToListItem);
  }

  const { rows } = await sql`
    SELECT id, slug, title, subtitle, excerpt, cover_image_url, cover_image_alt,
           category_slug, is_featured, status, published_at,
           reading_time_minutes, author_user_id
    FROM blog_posts
    WHERE status = 'published'
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT ${limit} OFFSET ${offset};
  `;
  return rows.map(rowToListItem);
}

/** Total count of published posts, honoring the same optional category filter. */
export async function getPublishedPostCount(opts?: {
  category?: string;
}): Promise<number> {
  if (opts?.category) {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM blog_posts
      WHERE status = 'published' AND category_slug = ${opts.category};
    `;
    return Number(rows[0]?.n ?? 0);
  }
  const { rows } = await sql`
    SELECT COUNT(*)::int AS n FROM blog_posts WHERE status = 'published';
  `;
  return Number(rows[0]?.n ?? 0);
}

/** The one featured post, if any — must also be published to surface publicly. */
export async function getFeaturedPost(): Promise<BlogPostListItem | null> {
  const { rows } = await sql`
    SELECT id, slug, title, subtitle, excerpt, cover_image_url, cover_image_alt,
           category_slug, is_featured, status, published_at,
           reading_time_minutes, author_user_id
    FROM blog_posts
    WHERE is_featured = TRUE AND status = 'published'
    LIMIT 1;
  `;
  return rows[0] ? rowToListItem(rows[0]) : null;
}

/**
 * Fetch a single post by slug. Public surface passes includeUnpublished=false
 * (the default) — draft/review/archived rows return null. Admin callers set
 * the flag to true to open any row for editing.
 */
export async function getPostBySlug(
  slug: string,
  includeUnpublished = false
): Promise<BlogPost | null> {
  if (includeUnpublished) {
    const { rows } = await sql`
      SELECT * FROM blog_posts WHERE slug = ${slug} LIMIT 1;
    `;
    return rows[0] ? rowToBlogPost(rows[0]) : null;
  }
  const { rows } = await sql`
    SELECT * FROM blog_posts
    WHERE slug = ${slug} AND status = 'published'
    LIMIT 1;
  `;
  return rows[0] ? rowToBlogPost(rows[0]) : null;
}

/** Admin helper — by id, any status. Separate from the slug path to keep the URL contract clean. */
export async function getPostById(id: string): Promise<BlogPost | null> {
  const { rows } = await sql`SELECT * FROM blog_posts WHERE id = ${id}::uuid LIMIT 1;`;
  return rows[0] ? rowToBlogPost(rows[0]) : null;
}

/**
 * Minimal shape for sitemap.xml generation — slug + updated_at only.
 * Kept separate from getPublishedPosts (which returns the richer list-
 * item shape) so the sitemap walker stays cheap at higher post counts.
 * Drafts / review / archived rows are filtered out at the SQL layer.
 */
export async function getPublishedPostSitemapEntries(): Promise<
  Array<{ slug: string; updatedAt: Date }>
> {
  const { rows } = await sql`
    SELECT slug, updated_at FROM blog_posts
    WHERE status = 'published'
    ORDER BY updated_at DESC;
  `;
  return rows.map((r) => ({
    slug: r.slug as string,
    updatedAt: new Date(r.updated_at)
  }));
}

// ─── Admin reads ───────────────────────────────────────────────────────────

/** Every post visible to admins, optionally filtered by status. */
export async function getAllPostsForAdmin(opts?: {
  status?: PostStatus;
}): Promise<BlogPostListItem[]> {
  if (opts?.status) {
    const { rows } = await sql`
      SELECT id, slug, title, subtitle, excerpt, cover_image_url, cover_image_alt,
             category_slug, is_featured, status, published_at,
             reading_time_minutes, author_user_id
      FROM blog_posts
      WHERE status = ${opts.status}
      ORDER BY updated_at DESC;
    `;
    return rows.map(rowToListItem);
  }
  const { rows } = await sql`
    SELECT id, slug, title, subtitle, excerpt, cover_image_url, cover_image_alt,
           category_slug, is_featured, status, published_at,
           reading_time_minutes, author_user_id
    FROM blog_posts
    ORDER BY updated_at DESC;
  `;
  return rows.map(rowToListItem);
}

/** Counts per status, for the admin filter pills. */
export async function getAdminPostCounts(): Promise<Record<PostStatus | "all", number>> {
  const { rows } = await sql`
    SELECT
      COUNT(*)::int AS all,
      SUM(CASE WHEN status = 'draft'     THEN 1 ELSE 0 END)::int AS draft,
      SUM(CASE WHEN status = 'review'    THEN 1 ELSE 0 END)::int AS review,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END)::int AS published,
      SUM(CASE WHEN status = 'archived'  THEN 1 ELSE 0 END)::int AS archived
    FROM blog_posts;
  `;
  const r = rows[0] ?? { all: 0, draft: 0, review: 0, published: 0, archived: 0 };
  return {
    all: Number(r.all ?? 0),
    draft: Number(r.draft ?? 0),
    review: Number(r.review ?? 0),
    published: Number(r.published ?? 0),
    archived: Number(r.archived ?? 0)
  };
}

/** Categories, display-order sorted. Used by form dropdowns + public filter bar. */
export async function getCategories(): Promise<PostCategory[]> {
  const { rows } = await sql`
    SELECT slug, name, description, display_order
    FROM post_categories
    ORDER BY display_order ASC, name ASC;
  `;
  return rows.map(rowToCategory);
}

// ─── Mutations ─────────────────────────────────────────────────────────────

/**
 * Resolve a unique slug for a new post. Tries the candidate first, then
 * appends -2, -3, etc until we find a free one. Separate from the insert
 * so a title edit during the save can't accidentally silently collide.
 */
async function uniqueSlug(candidate: string): Promise<string> {
  let attempt = candidate;
  let suffix = 1;
  while (true) {
    const { rows } = await sql`SELECT 1 FROM blog_posts WHERE slug = ${attempt} LIMIT 1;`;
    if (rows.length === 0) return attempt;
    suffix += 1;
    attempt = `${candidate}-${suffix}`;
  }
}

export async function createPost(
  data: CreatePostInput,
  userId: number
): Promise<BlogPost> {
  const title = data.title.trim();
  if (!title) throw new Error("title is required");
  if (!data.categorySlug) throw new Error("categorySlug is required");

  const slugCandidate =
    data.slug?.trim() || generateBlogSlug(title) || `post-${Date.now()}`;
  const slug = await uniqueSlug(slugCandidate);

  const readingTime = computeReadingTimeMinutes(data.bodyJson ?? null);
  const bodyJsonText = data.bodyJson === null || data.bodyJson === undefined
    ? null
    : JSON.stringify(data.bodyJson);

  // If caller flagged isFeatured=true, unset any other featured post first.
  // The DB's partial-unique index would otherwise reject the insert.
  if (data.isFeatured) {
    await sql`UPDATE blog_posts SET is_featured = FALSE WHERE is_featured = TRUE;`;
  }

  const { rows } = await sql`
    INSERT INTO blog_posts (
      slug, title, subtitle, excerpt,
      body_json, body_html,
      cover_image_url, cover_image_alt, social_cover_url,
      meta_title, meta_description,
      category_slug, is_featured,
      author_user_id, reading_time_minutes
    ) VALUES (
      ${slug},
      ${title},
      ${data.subtitle ?? null},
      ${data.excerpt ?? null},
      ${bodyJsonText}::jsonb,
      ${data.bodyHtml ?? null},
      ${data.coverImageUrl ?? null},
      ${data.coverImageAlt ?? null},
      ${data.socialCoverUrl ?? null},
      ${data.metaTitle ?? null},
      ${data.metaDescription ?? null},
      ${data.categorySlug},
      ${Boolean(data.isFeatured)},
      ${userId},
      ${readingTime}
    )
    RETURNING *;
  `;
  return rowToBlogPost(rows[0]);
}

export async function updatePost(
  id: string,
  data: UpdatePostInput,
  _userId: number
): Promise<BlogPost> {
  // Fetch current state so we can compute reading time off the merged body
  // and honor partial updates cleanly.
  const existing = await getPostById(id);
  if (!existing) throw new Error("Post not found");

  const nextBodyJson = data.bodyJson === undefined ? existing.bodyJson : data.bodyJson;
  const nextBodyJsonText = nextBodyJson === null ? null : JSON.stringify(nextBodyJson);
  const readingTime = computeReadingTimeMinutes(nextBodyJson);

  // Slug change: if caller sent an explicit slug, normalize + ensure unique.
  // Leave the existing slug untouched when data.slug is undefined.
  let nextSlug = existing.slug;
  if (data.slug !== undefined) {
    const candidate = data.slug.trim();
    if (!candidate) throw new Error("slug cannot be empty");
    if (candidate !== existing.slug) {
      nextSlug = await uniqueSlug(candidate);
    }
  }

  // Featured toggle: if promoting this row, unset any other featured row
  // first. If demoting, no extra work — the single UPDATE handles it.
  if (data.isFeatured === true && !existing.isFeatured) {
    await sql`UPDATE blog_posts SET is_featured = FALSE WHERE is_featured = TRUE AND id != ${id}::uuid;`;
  }

  const { rows } = await sql`
    UPDATE blog_posts SET
      slug                 = ${nextSlug},
      title                = ${data.title ?? existing.title},
      subtitle             = ${data.subtitle === undefined ? existing.subtitle : data.subtitle},
      excerpt              = ${data.excerpt === undefined ? existing.excerpt : data.excerpt},
      body_json            = ${nextBodyJsonText}::jsonb,
      body_html            = ${data.bodyHtml === undefined ? existing.bodyHtml : data.bodyHtml},
      cover_image_url      = ${data.coverImageUrl === undefined ? existing.coverImageUrl : data.coverImageUrl},
      cover_image_alt      = ${data.coverImageAlt === undefined ? existing.coverImageAlt : data.coverImageAlt},
      social_cover_url     = ${data.socialCoverUrl === undefined ? existing.socialCoverUrl : data.socialCoverUrl},
      meta_title           = ${data.metaTitle === undefined ? existing.metaTitle : data.metaTitle},
      meta_description     = ${data.metaDescription === undefined ? existing.metaDescription : data.metaDescription},
      category_slug        = ${data.categorySlug ?? existing.categorySlug},
      is_featured          = ${data.isFeatured === undefined ? existing.isFeatured : Boolean(data.isFeatured)},
      reading_time_minutes = ${readingTime},
      updated_at           = NOW()
    WHERE id = ${id}::uuid
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post not found");
  return rowToBlogPost(rows[0]);
}

export async function deletePost(id: string): Promise<void> {
  await sql`DELETE FROM blog_posts WHERE id = ${id}::uuid;`;
}

// ─── Status transitions ────────────────────────────────────────────────────
//
// Each transition keeps its invariant:
//   submit_for_review: draft → review, stamps submitted_at
//   publish:            draft/review → published, stamps published_at the
//                       FIRST time (leaves subsequent edits' published_at alone)
//   unpublish:          published → draft, clears published_at so re-publish
//                       restamps it
//   archive:            any → archived (terminal soft-delete)
//
// All of them bump updated_at via the UPDATE.

export async function submitForReview(id: string, _userId: number): Promise<BlogPost> {
  const { rows } = await sql`
    UPDATE blog_posts SET
      status       = 'review',
      submitted_at = NOW(),
      updated_at   = NOW()
    WHERE id = ${id}::uuid AND status = 'draft'
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post cannot be submitted from its current status");
  return rowToBlogPost(rows[0]);
}

export async function publishPost(id: string, userId: number): Promise<BlogPost> {
  const { rows } = await sql`
    UPDATE blog_posts SET
      status              = 'published',
      published_at        = COALESCE(published_at, NOW()),
      reviewed_by_user_id = ${userId},
      last_reviewed_at    = NOW(),
      updated_at          = NOW()
    WHERE id = ${id}::uuid AND status IN ('draft', 'review', 'archived')
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post cannot be published from its current status");
  return rowToBlogPost(rows[0]);
}

export async function unpublishPost(id: string, _userId: number): Promise<BlogPost> {
  const { rows } = await sql`
    UPDATE blog_posts SET
      status       = 'draft',
      published_at = NULL,
      updated_at   = NOW()
    WHERE id = ${id}::uuid AND status = 'published'
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post cannot be unpublished from its current status");
  return rowToBlogPost(rows[0]);
}

export async function archivePost(id: string, _userId: number): Promise<BlogPost> {
  const { rows } = await sql`
    UPDATE blog_posts SET
      status     = 'archived',
      updated_at = NOW()
    WHERE id = ${id}::uuid AND status != 'archived'
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post is already archived or does not exist");
  return rowToBlogPost(rows[0]);
}

// ─── Featured toggle ───────────────────────────────────────────────────────

export async function setFeatured(id: string, _userId: number): Promise<BlogPost> {
  // Unset any existing featured row (other than this one) first — the
  // partial unique index on is_featured = TRUE would otherwise reject
  // the second UPDATE with a 23505 violation.
  await sql`UPDATE blog_posts SET is_featured = FALSE WHERE is_featured = TRUE AND id != ${id}::uuid;`;
  const { rows } = await sql`
    UPDATE blog_posts SET is_featured = TRUE, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post not found");
  return rowToBlogPost(rows[0]);
}

export async function unsetFeatured(id: string, _userId: number): Promise<BlogPost> {
  const { rows } = await sql`
    UPDATE blog_posts SET is_featured = FALSE, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *;
  `;
  if (!rows[0]) throw new Error("Post not found");
  return rowToBlogPost(rows[0]);
}
