import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPost, getAllPostsForAdmin } from "@/lib/blog-queries";
import { canCreatePost } from "@/lib/blog-permissions";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import { getDestinationById } from "@/lib/db";
import type { BlogFaq, PostStatus } from "@/types/blog";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<PostStatus>(["draft", "review", "published", "archived"]);

/**
 * Coerce inbound FAQ payload to the canonical `BlogFaq[] | null` shape.
 * Accepts the array form, drops rows where either field is empty after
 * trim, and returns null when nothing valid remains — keeps "no FAQs"
 * stored as NULL (not []) so the public render's existence check
 * stays a clean `faqs && faqs.length > 0`.
 */
function normalizeFaqsInput(raw: unknown): BlogFaq[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned: BlogFaq[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = (item as { question?: unknown }).question;
    const a = (item as { answer?: unknown }).answer;
    if (typeof q !== "string" || typeof a !== "string") continue;
    const question = q.trim();
    const answer = a.trim();
    if (!question || !answer) continue;
    cleaned.push({ question, answer });
  }
  return cleaned.length > 0 ? cleaned : null;
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

  // Destination tag (D10). Optional, independent of category. This
  // branch validates id shape + existence; createPost takes the
  // value through verbatim.
  let destinationId: number | null = null;
  if (body?.destinationId !== undefined && body?.destinationId !== null) {
    const n = Number(body.destinationId);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json(
        { error: "Invalid destinationId." },
        { status: 400 }
      );
    }
    const dest = await getDestinationById(n).catch(() => null);
    if (!dest) {
      return NextResponse.json(
        { error: "Destination not found." },
        { status: 400 }
      );
    }
    destinationId = n;
  }

  try {
    const post = await createPost(
      {
        title,
        slug: typeof body?.slug === "string" ? body.slug : undefined,
        subtitle: body?.subtitle ?? null,
        excerpt: body?.excerpt ?? null,
        bodyJson: body?.bodyJson ?? null,
        // Create path: no "skip" semantics, coerce undefined → null.
        bodyHtml: sanitizeBlogHtml(body?.bodyHtml) ?? null,
        coverImageUrl: body?.coverImageUrl ?? null,
        coverImageAlt: body?.coverImageAlt ?? null,
        // Create path rarely sets lastUpdatedAt — a brand-new post
        // hasn't been refreshed. Plumbed through anyway so seed
        // imports / future API consumers can stamp it on insert.
        lastUpdatedAt:
          typeof body?.lastUpdatedAt === "string"
            ? body.lastUpdatedAt
            : null,
        faqs: normalizeFaqsInput(body?.faqs),
        socialCoverUrl: body?.socialCoverUrl ?? null,
        metaTitle: body?.metaTitle ?? null,
        metaDescription: body?.metaDescription ?? null,
        categorySlug,
        isFeatured: Boolean(body?.isFeatured),
        destinationId
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
