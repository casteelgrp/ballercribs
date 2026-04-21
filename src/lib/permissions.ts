import type { Listing, User } from "./types";

// Permission helpers gate the workflow state machine. Rules live here so
// adding a new role (e.g. "agent") later means changing this file only —
// not hunting `user.role === 'owner'` checks across the codebase.

export function isOwner(user: User): boolean {
  return user.role === "owner";
}

/** Owner sees everything. Users see their own listings (any status) plus all published. */
export function canViewListing(user: User, listing: Listing): boolean {
  if (isOwner(user)) return true;
  if (listing.status === "published") return true;
  return listing.created_by_user_id === user.id;
}

export function canEdit(user: User, listing: Listing): boolean {
  if (isOwner(user)) return true;
  if (listing.created_by_user_id !== user.id) return false;
  // Non-owners can edit their own draft, but once it's in review or published
  // they shouldn't change it from under the reviewer / public.
  return listing.status === "draft";
}

export function canSubmitForReview(user: User, listing: Listing): boolean {
  if (listing.status !== "draft") return false;
  if (isOwner(user)) return true;
  return listing.created_by_user_id === user.id;
}

/** Owners can publish directly from any non-published, non-archived state. */
export function canPublishDirect(user: User, listing: Listing): boolean {
  if (!isOwner(user)) return false;
  return listing.status === "draft" || listing.status === "review";
}

export function canApprove(user: User, listing: Listing): boolean {
  return isOwner(user) && listing.status === "review";
}

export function canSendBackToDraft(user: User, listing: Listing): boolean {
  return isOwner(user) && listing.status === "review";
}

export function canArchive(user: User, listing: Listing): boolean {
  return isOwner(user) && listing.status === "published";
}

export function canRestoreFromArchive(user: User, listing: Listing): boolean {
  return isOwner(user) && listing.status === "archived";
}

export function canDelete(user: User): boolean {
  return isOwner(user);
}

/** Status transitions a user can perform on a listing. Used to render action buttons. */
export interface AvailableTransitions {
  edit: boolean;
  submitForReview: boolean;
  publishDirect: boolean;
  approve: boolean;
  sendBack: boolean;
  archive: boolean;
  restore: boolean;
  delete: boolean;
}

export function availableTransitions(user: User, listing: Listing): AvailableTransitions {
  return {
    edit: canEdit(user, listing),
    submitForReview: canSubmitForReview(user, listing),
    publishDirect: canPublishDirect(user, listing),
    approve: canApprove(user, listing),
    sendBack: canSendBackToDraft(user, listing),
    archive: canArchive(user, listing),
    restore: canRestoreFromArchive(user, listing),
    delete: canDelete(user)
  };
}
