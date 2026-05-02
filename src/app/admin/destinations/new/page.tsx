import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { DestinationForm } from "@/components/admin/DestinationForm";

export const dynamic = "force-dynamic";

export default async function NewDestinationPage() {
  await requirePageUser();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link
          href="/admin/destinations"
          className="text-xs uppercase tracking-widest text-black/55 hover:text-accent"
        >
          ← All destinations
        </Link>
        <h2 className="font-display text-2xl mt-2">New destination</h2>
      </div>

      <DestinationForm existing={null} />
    </div>
  );
}
