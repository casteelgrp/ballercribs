import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { getCategories } from "@/lib/blog-queries";
import { BlogForm } from "@/components/BlogForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New post — BallerCribs" };

export default async function NewBlogPostPage() {
  const user = await requirePageUser();
  const categories = await getCategories().catch(() => []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <Link
        href="/admin/blog"
        className="text-xs uppercase tracking-widest text-black/50 hover:text-ink"
      >
        ← All posts
      </Link>
      <h2 className="font-display text-2xl mt-3 mb-8">New post</h2>
      <BlogForm currentUser={user} categories={categories} />
    </div>
  );
}
