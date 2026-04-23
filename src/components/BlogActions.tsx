"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isOwner } from "@/lib/permissions";
import type { BlogPostListItem, PostStatus } from "@/types/blog";
import type { User } from "@/lib/types";

/**
 * Inline admin-table actions for a blog post row. Gates visibility by
 * role + status so non-owners only see draft-safe actions (edit,
 * submit). Owners get the full set: edit, publish/unpublish, feature
 * toggle, archive, delete.
 */
export function BlogActions({
  user,
  post
}: {
  user: User;
  post: BlogPostListItem & { authorUserId?: number | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const owner = isOwner(user);

  async function call(path: string, opts?: { confirm?: string; method?: "POST" | "DELETE" }) {
    if (opts?.confirm && !window.confirm(opts.confirm)) return;
    setBusy(true);
    const res = await fetch(path, { method: opts?.method ?? "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error || "Action failed.");
      return;
    }
    router.refresh();
  }

  const btn =
    "text-[10px] uppercase tracking-widest border border-black/20 px-2 py-1 disabled:opacity-30 hover:border-black/40 transition-colors";

  // Non-owner users see Edit only on drafts they authored.
  const canEdit =
    owner ||
    (post.authorUserId === user.id && post.status === "draft");

  return (
    <div className="flex flex-wrap gap-1">
      {canEdit && (
        <a href={`/admin/blog/${post.id}/edit`} className={btn}>
          Edit
        </a>
      )}
      {owner && (post.status === "draft" || post.status === "review") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => call(`/api/admin/blog/posts/${post.id}/publish`)}
          className={btn}
        >
          Publish
        </button>
      )}
      {owner && post.status === "published" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(`/api/admin/blog/posts/${post.id}/unpublish`, {
              confirm: `Unpublish "${post.title}"? It will disappear from the public blog.`
            })
          }
          className={btn}
        >
          Unpublish
        </button>
      )}
      {owner && (
        <button
          type="button"
          disabled={busy}
          onClick={() => call(`/api/admin/blog/posts/${post.id}/feature`)}
          className={btn + (post.isFeatured ? " bg-accent text-ink border-accent" : "")}
        >
          {post.isFeatured ? "★ Featured" : "Feature"}
        </button>
      )}
      {owner && post.status !== "archived" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(`/api/admin/blog/posts/${post.id}/archive`, {
              confirm: `Archive "${post.title}"? Hidden from the public blog and default admin view.`
            })
          }
          className={btn}
        >
          Archive
        </button>
      )}
      {owner && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(`/api/admin/blog/posts/${post.id}`, {
              confirm: `Permanently delete "${post.title}"? This cannot be undone.`,
              method: "DELETE"
            })
          }
          className={btn + " hover:border-red-500 hover:text-red-600"}
        >
          Delete
        </button>
      )}
    </div>
  );
}

// Keep a typed re-export so the index page can pass through the
// includes-authorUserId shape without widening BlogPostListItem globally.
export type BlogRowForActions = BlogPostListItem & { authorUserId?: number | null; status: PostStatus };
