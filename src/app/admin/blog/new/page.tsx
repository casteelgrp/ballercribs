import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { getCategories } from "@/lib/blog-queries";
import { getPublishedDestinations } from "@/lib/db";
import { isOwner } from "@/lib/permissions";
import { BlogForm } from "@/components/BlogForm";
import { AdminFormCard, AdminFormShell } from "@/components/admin/AdminFormShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New post — BallerCribs" };

export default async function NewBlogPostPage() {
  const user = await requirePageUser();
  // Destination is an independent tag available on every post — Rentals,
  // Case Studies, and News posts about specific places all use it. New
  // posts have no draft destination to pin, so published-only is enough.
  const [categories, destinations] = await Promise.all([
    getCategories().catch(() => []),
    getPublishedDestinations().catch(() => [])
  ]);

  return (
    <AdminFormShell>
      <section>
        <h2 className="font-display text-2xl mb-1">New post</h2>
        <p className="text-sm text-black/60 mb-6">
          {isOwner(user)
            ? "Save as draft, submit for review, or publish directly."
            : "Save as draft to keep editing, or submit for review when it's ready."}
        </p>
        <AdminFormCard>
          <BlogForm
            currentUser={user}
            categories={categories}
            destinations={destinations}
          />
        </AdminFormCard>
      </section>
    </AdminFormShell>
  );
}
