import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPost, getAllPostsForAdmin } from "@/lib/blog-queries";
import { canCreatePost } from "@/lib/blog-permissions";
import type { PostStatus } from "@/types/blog";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<PostStatus>(["draft", "review", "published", "archived"]);

export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  void user; // admin-scoped list — any authed user, no extra gating

  const { searchParams } = new URL(req.url);
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw && VALID_STATUSES.has(statusRaw as PostStatus)
      ? (statusRaw as PostStatus)
      : undefined;

  try {
    const posts = await getAllPostsForAdmin({ status });
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("Failed to list blog posts:", err);
    return NextResponse.json({ error: "Failed to list posts." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  if (!canCreatePost(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const categorySlug = typeof body?.categorySlug === "string" ? body.categorySlug.trim() : "";

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!categorySlug) return NextResponse.json({ error: "Category is required." }, { status: 400 });

  try {
    const post = await createPost(
      {
        title,
        slug: typeof body?.slug === "string" ? body.slug : undefined,
        subtitle: body?.subtitle ?? null,
        excerpt: body?.excerpt ?? null,
        bodyJson: body?.bodyJson ?? null,
        bodyHtml: typeof body?.bodyHtml === "string" ? body.bodyHtml : null,
        coverImageUrl: body?.coverImageUrl ?? null,
        socialCoverUrl: body?.socialCoverUrl ?? null,
        metaTitle: body?.metaTitle ?? null,
        metaDescription: body?.metaDescription ?? null,
        categorySlug,
        isFeatured: Boolean(body?.isFeatured)
      },
      user.id
    );
    return NextResponse.json({ post });
  } catch (err: any) {
    console.error("Failed to create blog post:", err);
    // 23503 = FK violation (invalid category_slug). 23505 = unique violation
    // (slug collision, though uniqueSlug() should prevent this).
    if (err?.code === "23503") {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create post." }, { status: 500 });
  }
}
