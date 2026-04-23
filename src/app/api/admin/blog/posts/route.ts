import { NextResponse } from "next/server";
import DOMPurify from "isomorphic-dompurify";
import { requireUser } from "@/lib/auth";
import { createPost, getAllPostsForAdmin } from "@/lib/blog-queries";
import { canCreatePost } from "@/lib/blog-permissions";
import type { PostStatus } from "@/types/blog";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<PostStatus>(["draft", "review", "published", "archived"]);

// body_html comes from the TipTap editor via editor.getHTML(). Our own
// editor is the authored source, but we sanitize anyway — cheap XSS
// insurance against a future path that accepts HTML from elsewhere, or
// a compromised author session. The allowlist matches our extension set
// (StarterKit + Link + Image + PropertyCard) plus the property-card
// attrs so the renderHTML output survives the pass.
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

function sanitizeHtml(input: string | null | undefined): string | null {
  if (input === null || input === undefined || input === "") return null;
  return DOMPurify.sanitize(input, SANITIZE_CONFIG);
}

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
        bodyHtml: sanitizeHtml(typeof body?.bodyHtml === "string" ? body.bodyHtml : null),
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
