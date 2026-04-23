import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPostById, submitForReview } from "@/lib/blog-queries";
import { canEditPost } from "@/lib/blog-permissions";

export const runtime = "nodejs";

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

  const { id } = await params;
  const post = await getPostById(id).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  // Submitting for review is effectively an edit + transition; same bar
  // as canEditPost — the author (or an owner) can move the draft on.
  if (!canEditPost(user, post)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const next = await submitForReview(id, user.id);
    return NextResponse.json({ post: next });
  } catch (err: any) {
    console.error("Failed to submit post for review:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit post." },
      { status: 400 }
    );
  }
}
