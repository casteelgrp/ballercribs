import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deletePost, getPostById, updatePost } from "@/lib/blog-queries";
import { canDeletePost, canEditPost } from "@/lib/blog-permissions";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;

  const post = await getPostById(id).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (!canEditPost(user, post)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const updated = await updatePost(
      id,
      {
        title: typeof body?.title === "string" ? body.title : undefined,
        slug: typeof body?.slug === "string" ? body.slug : undefined,
        subtitle: body?.subtitle,
        excerpt: body?.excerpt,
        bodyJson: body?.bodyJson,
        bodyHtml: sanitizeBlogHtml(body?.bodyHtml),
        coverImageUrl: body?.coverImageUrl,
        coverImageAlt: body?.coverImageAlt,
        socialCoverUrl: body?.socialCoverUrl,
        metaTitle: body?.metaTitle,
        metaDescription: body?.metaDescription,
        categorySlug: typeof body?.categorySlug === "string" ? body.categorySlug : undefined,
        isFeatured: body?.isFeatured
      },
      user.id
    );
    return NextResponse.json({ post: updated });
  } catch (err: any) {
    console.error("Failed to update blog post:", err);
    if (err?.code === "23503") {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update post." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;

  const post = await getPostById(id).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (!canDeletePost(user, post)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete blog post:", err);
    return NextResponse.json({ error: "Failed to delete post." }, { status: 500 });
  }
}
