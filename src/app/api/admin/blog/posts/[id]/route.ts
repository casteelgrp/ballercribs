import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deletePost, getPostById, updatePost } from "@/lib/blog-queries";
import { canDeletePost, canEditPost } from "@/lib/blog-permissions";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import { getDestinationById } from "@/lib/db";
import type { BlogFaq } from "@/types/blog";

export const runtime = "nodejs";

/**
 * PATCH semantics: undefined preserves existing, explicit array sets,
 * null clears. The form always sends one of those — never a partial
 * object — so we don't need a deeper diff. Empty rows (missing q or a
 * after trim) drop on the way through, mirroring the create path.
 */
function normalizeFaqsPatch(raw: unknown): BlogFaq[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return undefined;
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

  // Coerce lastUpdatedAt: undefined preserves existing, null clears,
  // string sets. Anything else is treated as undefined.
  const rawLastUpdated = body?.lastUpdatedAt;
  const lastUpdatedAt:
    | string
    | null
    | undefined =
    typeof rawLastUpdated === "string"
      ? rawLastUpdated
      : rawLastUpdated === null
        ? null
        : undefined;

  // Destination tag (D10). undefined preserves, null clears, integer
  // sets. Independent of category; updatePost takes the value
  // through verbatim. Validate id shape + existence so a bogus id
  // surfaces as a clean 400 rather than a 23503 from the FK.
  let destinationIdPatch: number | null | undefined = undefined;
  if ("destinationId" in body) {
    const raw = body.destinationId;
    if (raw === null || raw === "") {
      destinationIdPatch = null;
    } else {
      const n = Number(raw);
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
      destinationIdPatch = n;
    }
  }

  // Validate ordering when both are present and the post is published —
  // a draft can carry a stray last_updated_at without being misleading,
  // but a published post claiming refresh predates publish is wrong.
  if (typeof lastUpdatedAt === "string" && post.publishedAt) {
    const refresh = new Date(lastUpdatedAt);
    if (Number.isNaN(refresh.getTime())) {
      return NextResponse.json(
        { error: "Invalid lastUpdatedAt value." },
        { status: 400 }
      );
    }
    if (refresh.getTime() < post.publishedAt.getTime()) {
      return NextResponse.json(
        { error: "Last updated must be on or after the publish date." },
        { status: 400 }
      );
    }
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
        isFeatured: body?.isFeatured,
        lastUpdatedAt,
        faqs: normalizeFaqsPatch(body?.faqs),
        destinationId: destinationIdPatch
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
