import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPostById, unpublishPost } from "@/lib/blog-queries";
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

  // Unpublish is owner-only — same gate as publish (anyone who can't put
  // something live shouldn't be able to yank it either).
  if (!canPublishPost(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const post = await getPostById(id).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  try {
    const next = await unpublishPost(id, user.id);
    return NextResponse.json({ post: next });
  } catch (err: any) {
    console.error("Failed to unpublish post:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to unpublish post." },
      { status: 400 }
    );
  }
}
