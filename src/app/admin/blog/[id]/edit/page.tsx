import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getCategories, getPostById } from "@/lib/blog-queries";
import { canEditPost } from "@/lib/blog-permissions";
import { BlogForm } from "@/components/BlogForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit post — BallerCribs" };

export default async function EditBlogPostPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const post = await getPostById(id).catch(() => null);
  if (!post) notFound();

  // Same gate as the PATCH endpoint — a non-owner user who doesn't own
  // this draft lands on a 404 rather than a form they can't submit.
  if (!canEditPost(user, post)) notFound();

  const categories = await getCategories().catch(() => []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <Link
        href="/admin/blog"
        className="text-xs uppercase tracking-widest text-black/50 hover:text-ink"
      >
        ← All posts
      </Link>
      <div className="flex items-baseline justify-between mt-3 mb-8">
        <h2 className="font-display text-2xl">Edit post</h2>
        <span className="text-[10px] uppercase tracking-widest text-black/50">
          {post.status}
        </span>
      </div>
      <BlogForm currentUser={user} categories={categories} existing={post} />
    </div>
  );
}
