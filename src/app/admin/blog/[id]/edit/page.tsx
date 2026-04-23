import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getCategories, getPostById } from "@/lib/blog-queries";
import { canEditPost } from "@/lib/blog-permissions";
import { BlogForm } from "@/components/BlogForm";
import { AdminFormCard, AdminFormShell } from "@/components/admin/AdminFormShell";

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
    <AdminFormShell>
      <div className="mb-8">
        <h2 className="font-display text-2xl">Edit post</h2>
        <p className="text-sm text-black/60 mt-1">
          {post.title} · status: {post.status}
        </p>
      </div>
      <AdminFormCard>
        <BlogForm currentUser={user} categories={categories} existing={post} />
      </AdminFormCard>
    </AdminFormShell>
  );
}
