import type { BlogPost, PostStatus } from "@/types/blog";
import type { User } from "./types";
import { isOwner } from "./permissions";

// Permission gating for the blog workflow. Mirrors the listings permissions
// pattern — per-action helpers so future role additions change this file
// only. Roles are the existing ('owner' | 'user'); a non-owner user can
// draft and submit for review, but only the owner can publish or delete.

export function canCreatePost(_user: User): boolean {
  // Any authenticated admin user can start a draft.
  return true;
}

/**
 * Narrowed to the minimum shape needed so both BlogPost and
 * BlogPostListItem callers (admin table + edit page) go through the same
 * function. Drift between "can see Edit" and "can actually edit" would
 * surface as a 403 after click — route everything through this helper.
 */
export function canEditPost(
  user: User,
  post: { authorUserId: number | null; status: PostStatus }
): boolean {
  if (isOwner(user)) return true;
  if (post.authorUserId !== user.id) return false;
  return post.status === "draft";
}

export function canDeletePost(user: User, _post: BlogPost): boolean {
  return isOwner(user);
}

/** Owners can publish directly from draft, review, or (republish from) archived. */
export function canPublishPost(user: User): boolean {
  return isOwner(user);
}

export function canReviewPost(user: User): boolean {
  return isOwner(user);
}
