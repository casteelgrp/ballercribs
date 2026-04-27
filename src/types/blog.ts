/**
 * Blog types. Kept separate from src/lib/types.ts so the blog feature's
 * surface area stays legible — listings + inquiries already dominate the
 * shared types file, blog concepts don't need to fight for space there.
 *
 * User FK columns are `number | null` because users.id is SERIAL/INTEGER.
 * blog_posts.id is a UUID (new table, no legacy constraint), so it
 * surfaces as `string`.
 */

export type PostStatus = "draft" | "review" | "published" | "archived";

export type PostCategory = {
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  /** TipTap JSONContent — typed as unknown until commit 3 installs @tiptap/core. */
  bodyJson: unknown | null;
  bodyHtml: string | null;
  coverImageUrl: string | null;
  /** Accessibility text for the cover. Falls back to post.title on render. */
  coverImageAlt: string | null;
  socialCoverUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  categorySlug: string;
  isFeatured: boolean;
  status: PostStatus;
  submittedAt: Date | null;
  publishedAt: Date | null;
  /**
   * Editorially-set refresh timestamp. Null = post hasn't been
   * refreshed since publish. Distinct from updatedAt (auto-bumped on
   * every save). Drives the "Updated <date>" byline + JSON-LD
   * dateModified + sitemap lastmod when set + >24h after publish.
   */
  lastUpdatedAt: Date | null;
  reviewedByUserId: number | null;
  lastReviewedAt: Date | null;
  authorUserId: number | null;
  readingTimeMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BlogPostListItem = Pick<
  BlogPost,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "excerpt"
  | "coverImageUrl"
  | "coverImageAlt"
  | "categorySlug"
  | "isFeatured"
  | "status"
  | "publishedAt"
  | "lastUpdatedAt"
  | "readingTimeMinutes"
  | "authorUserId"
>;

/**
 * Input shape for createPost — title and categorySlug are required,
 * everything else is optional and defaults on the DB side. Slug is
 * auto-derived from title when absent.
 */
export type CreatePostInput = {
  title: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  bodyJson?: unknown | null;
  bodyHtml?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  socialCoverUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  categorySlug: string;
  isFeatured?: boolean;
  /** ISO timestamp string for editorial refresh; null clears it. */
  lastUpdatedAt?: string | null;
};

/**
 * Input shape for updatePost — all fields optional. Partial<CreatePostInput>
 * doesn't quite fit because categorySlug can be updated too.
 */
export type UpdatePostInput = Partial<CreatePostInput>;
