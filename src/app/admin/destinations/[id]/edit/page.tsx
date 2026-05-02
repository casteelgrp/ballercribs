import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getDestinationById, getDestinationCounts } from "@/lib/db";
import { DestinationForm } from "@/components/admin/DestinationForm";

export const dynamic = "force-dynamic";

export default async function EditDestinationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();

  const destination = await getDestinationById(numericId).catch(() => null);
  if (!destination) notFound();

  const counts = await getDestinationCounts(numericId).catch(() => ({
    listings: 0,
    rentals: 0,
    blog_posts: 0
  }));
  const total = counts.listings + counts.rentals + counts.blog_posts;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link
          href="/admin/destinations"
          className="text-xs uppercase tracking-widest text-black/55 hover:text-accent"
        >
          ← All destinations
        </Link>
        <h2 className="font-display text-2xl mt-2">Edit {destination.name}</h2>
        {total > 0 && (
          <p className="text-xs text-black/55 mt-1">
            {counts.listings} listing{counts.listings === 1 ? "" : "s"} ·{" "}
            {counts.rentals} rental{counts.rentals === 1 ? "" : "s"} ·{" "}
            {counts.blog_posts} stor{counts.blog_posts === 1 ? "y" : "ies"} attached.
          </p>
        )}
      </div>

      <DestinationForm existing={destination} attachedCounts={counts} />
    </div>
  );
}
