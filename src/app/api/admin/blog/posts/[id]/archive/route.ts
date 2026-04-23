import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { archivePost, getPostById } from "@/lib/blog-queries";
import { canDeletePost } from "@/lib/blog-permissions";

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

  // Archive is a soft-delete; same bar as delete (owner-only).
  if (!canDeletePost(user, post)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const next = await archivePost(id, user.id);
    return NextResponse.json({ post: next });
  } catch (err: any) {
    console.error("Failed to archive post:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to archive post." },
      { status: 400 }
    );
  }
}
