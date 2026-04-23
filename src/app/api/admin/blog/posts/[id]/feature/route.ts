import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPostById, setFeatured, unsetFeatured } from "@/lib/blog-queries";
import { canPublishPost } from "@/lib/blog-permissions";

export const runtime = "nodejs";

/**
 * Toggle the featured flag. Owner-only — featured placement is
 * merchandising, not authorship. Ignoring the body and deriving intent
 * from the current state keeps the client simple and makes double-taps
 * idempotent (second press un-features).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  if (!canPublishPost(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const post = await getPostById(id).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  try {
    const next = post.isFeatured
      ? await unsetFeatured(id, user.id)
      : await setFeatured(id, user.id);
    return NextResponse.json({ post: next });
  } catch (err: any) {
    console.error("Failed to toggle featured:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to toggle featured." },
      { status: 400 }
    );
  }
}
