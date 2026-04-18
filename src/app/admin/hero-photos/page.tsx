import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listAllHeroPhotos } from "@/lib/db";
import { isOwner } from "@/lib/permissions";
import { HeroPhotosManager } from "@/components/HeroPhotosManager";

export const dynamic = "force-dynamic";

export default async function AdminHeroPhotosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.must_change_password) redirect("/admin/account?force=1");
  // Same opacity treatment as /admin/users — non-owners get a 404, not a 403,
  // so the existence of the route isn't telegraphed.
  if (!isOwner(user)) notFound();

  const photos = await listAllHeroPhotos();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Hero Photos</h1>
          <p className="text-sm text-black/60 mt-1">
            Curated separately from listing photos. These rotate on the homepage hero.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-accent"
          >
            Preview live hero ↗
          </Link>
          <Link href="/admin" className="underline underline-offset-4 hover:text-accent">
            Back to admin
          </Link>
        </div>
      </div>

      <HeroPhotosManager initial={photos} />
    </div>
  );
}
