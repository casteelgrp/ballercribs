import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getCategories, getPostById } from "@/lib/blog-queries";
import { getDestinationById, getPublishedDestinations } from "@/lib/db";
import { canEditPost } from "@/lib/blog-permissions";
import { BlogForm } from "@/components/BlogForm";
import { AdminFormCard, AdminFormShell } from "@/components/admin/AdminFormShell";
import type { Destination } from "@/lib/types";

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

  const [categories, publishedDestinations] = await Promise.all([
    getCategories().catch(() => []),
    getPublishedDestinations().catch(() => [])
  ]);

  // Pin pattern: prepend the post's draft destination tag (if any) so
  // the dropdown can re-save without dropping a tag pointing at an
  // unpublished destination. Only matters for the Destinations
  // category — but the prepend is cheap, and the dropdown only
  // renders for that category anyway.
  let destinations: Destination[] = publishedDestinations;
  if (
    post.destinationId !== null &&
    !destinations.some((d) => d.id === post.destinationId)
  ) {
    const draft = await getDestinationById(post.destinationId).catch(() => null);
    if (draft) destinations = [draft, ...destinations];
  }

  return (
    <AdminFormShell>
      <div className="mb-8">
        <h2 className="font-display text-2xl">Edit post</h2>
        <p className="text-sm text-black/60 mt-1">
          {post.title} · status: {post.status}
        </p>
      </div>
      <AdminFormCard>
        <BlogForm
          currentUser={user}
          categories={categories}
          existing={post}
          destinations={destinations}
        />
      </AdminFormCard>
    </AdminFormShell>
  );
}
