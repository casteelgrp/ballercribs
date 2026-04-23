import { NextResponse } from "next/server";
import DOMPurify from "isomorphic-dompurify";
import { requireUser } from "@/lib/auth";
import { deletePost, getPostById, updatePost } from "@/lib/blog-queries";
import { canDeletePost, canEditPost } from "@/lib/blog-permissions";

export const runtime = "nodejs";

// Same allowlist as the create route — keep in sync if we extend the
// editor's node palette. The set here matches StarterKit + Link + Image
// + PropertyCard's renderHTML output.
const SANITIZE_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "code", "pre",
    "blockquote", "h1", "h2", "h3", "h4", "ul", "ol", "li",
    "hr", "a", "img", "div", "span"
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "src", "alt", "title", "loading",
    "class", "data-property-card"
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|\/|mailto:|tel:|#)/i
};

function sanitizeHtml(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  if (input === "") return "";
  return DOMPurify.sanitize(input, SANITIZE_CONFIG);
}

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
        bodyHtml: sanitizeHtml(body?.bodyHtml),
        coverImageUrl: body?.coverImageUrl,
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
