/**
 * Search result shapes. Admin and public searches surface the same two
 * underlying kinds (listing + blog post) but filter and paginate them
 * differently. The UI branches on `kind` to render the appropriate
 * card and link target.
 */

import type { ListingStatus, ListingType } from "@/lib/types";
import type { PostStatus } from "@/types/blog";

export type SearchListing = {
  kind: "listing";
  id: number;
  slug: string;
  title: string;
  location: string;
  listingType: ListingType;
  status: ListingStatus;
  /** Non-null = this listing has been sold; public search still surfaces it. */
  soldAt: Date | null;
  heroImageUrl: string | null;
  /** ts_headline output around the match — plain text, no markup. */
  snippet: string;
  /** ts_rank score, higher = better match. */
  rank: number;
};

export type SearchBlogPost = {
  kind: "blog";
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: PostStatus;
  coverImageUrl: string | null;
  categorySlug: string;
  snippet: string;
  rank: number;
};

export type SearchResult = SearchListing | SearchBlogPost;

/**
 * Admin search groups results by kind so the UI can render a section
 * per content type. Each bucket is independently capped.
 */
export type AdminSearchResults = {
  listings: SearchListing[];
  blogs: SearchBlogPost[];
};
