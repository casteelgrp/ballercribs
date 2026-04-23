import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPostById, publishPost } from "@/lib/blog-queries";
import { canPublishPost } from "@/lib/blog-permissions";

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

  if (!canPublishPost(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const post = await getPostById(id).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  try {
    const next = await publishPost(id, user.id);
    return NextResponse.json({ post: next });
  } catch (err: any) {
    console.error("Failed to publish post:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to publish post." },
      { status: 400 }
    );
  }
}
