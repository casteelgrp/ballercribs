import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { getAdminPostCounts, getAllPostsForAdmin, getCategories } from "@/lib/blog-queries";
import { canEditPost } from "@/lib/blog-permissions";
import { BlogActions } from "@/components/BlogActions";
import type { PostStatus } from "@/types/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Blog — BallerCribs" };

const TAB_ORDER: (PostStatus | "all")[] = ["all", "draft", "review", "published", "archived"];
const TAB_LABEL: Record<PostStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  review: "Review",
  published: "Published",
  archived: "Archived"
};

// Same badge palette as /admin/listings so the admin reads consistently
// across tables.
const STATUS_BADGE: Record<PostStatus, string> = {
  draft: "bg-black/10 text-black/70",
  review: "bg-accent/20 text-accent",
  published: "bg-green-100 text-green-800",
  archived: "bg-black/20 text-black/40"
};

export default async function AdminBlogIndexPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePageUser();
  const sp = await searchParams;

  const requested = (sp.status as (typeof TAB_ORDER)[number] | undefined) ?? "all";
  const currentTab: (typeof TAB_ORDER)[number] = TAB_ORDER.includes(requested)
    ? requested
    : "all";

  const [posts, counts, categories] = await Promise.all([
    getAllPostsForAdmin({
      status: currentTab === "all" ? undefined : currentTab
    }).catch(() => []),
    getAdminPostCounts().catch(() => ({
      all: 0,
      draft: 0,
      review: 0,
      published: 0,
      archived: 0
    })),
    getCategories().catch(() => [])
  ]);

  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-display text-2xl">Blog</h2>
        <Link
          href="/admin/blog/new"
          className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
        >
          New post
        </Link>
      </div>

      {/* Status filter pills — matches /admin/listings overflow behaviour */}
      <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto md:overflow-x-visible">
        {TAB_ORDER.map((tab) => {
          const count = counts[tab] ?? 0;
          const active = tab === currentTab;
          const href = tab === "all" ? "/admin/blog" : `/admin/blog?status=${tab}`;
          return (
            <Link
              key={tab}
              href={href}
              className={
                "px-3 py-2 text-sm uppercase tracking-widest border-b-2 -mb-px transition-colors whitespace-nowrap " +
                (active
                  ? "border-accent text-ink"
                  : "border-transparent text-black/50 hover:text-ink")
              }
            >
              {TAB_LABEL[tab]} <span className="text-black/40">({count})</span>
            </Link>
          );
        })}
      </div>

      {posts.length === 0 ? (
        <p className="text-black/50 text-sm">No posts in this view yet.</p>
      ) : (
        <div className="border border-black/10 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-xs uppercase tracking-widest text-black/50">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Published</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {posts.map((post) => {
                // Same gate the Edit button and PATCH route use — keeps
                // the title link from sending users to a 404 they can't
                // avoid. Non-editable rows render plain text.
                const editable = canEditPost(user, post);
                return (
                <tr key={post.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {post.isFeatured && (
                        <span aria-label="Featured" className="text-accent" title="Featured">
                          ★
                        </span>
                      )}
                      {editable ? (
                        <Link
                          href={`/admin/blog/${post.id}/edit`}
                          className="font-medium hover:text-accent transition-colors"
                        >
                          {post.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{post.title}</span>
                      )}
                    </div>
                    <p className="text-xs text-black/50 mt-0.5 font-mono">/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-black/70">
                    {categoryName.get(post.categorySlug) ?? post.categorySlug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                        STATUS_BADGE[post.status]
                      }
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-black/60 whitespace-nowrap">
                    {post.publishedAt
                      ? post.publishedAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BlogActions user={user} post={post} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
