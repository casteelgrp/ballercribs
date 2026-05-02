import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { getAllDestinations, getDestinationCountsMap } from "@/lib/db";
import { DestinationRowActions } from "@/components/admin/DestinationRowActions";

export const dynamic = "force-dynamic";

export default async function AdminDestinationsPage() {
  await requirePageUser();

  const [destinations, counts] = await Promise.all([
    getAllDestinations().catch(() => []),
    getDestinationCountsMap().catch(() => ({} as Record<number, { listings: number; rentals: number; blog_posts: number }>))
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-baseline justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Destinations</h2>
          <p className="text-sm text-black/55 mt-1 max-w-xl">
            Group listings, rentals, and stories by place. Each
            destination gets its own public page.
          </p>
        </div>
        <Link
          href="/admin/destinations/new"
          className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
        >
          + New destination
        </Link>
      </div>

      {destinations.length === 0 ? (
        <div className="border border-dashed border-black/20 py-16 text-center text-black/55">
          <p>No destinations yet.</p>
          <p className="text-xs mt-2">
            Create one to start tagging listings, rentals, and stories.
          </p>
        </div>
      ) : (
        <div className="border border-black/10 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.03] text-[10px] uppercase tracking-widest text-black/55">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Region</th>
                <th className="text-right p-3">Listings</th>
                <th className="text-right p-3">Rentals</th>
                <th className="text-right p-3">Stories</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {destinations.map((d) => {
                const c = counts[d.id] ?? { listings: 0, rentals: 0, blog_posts: 0 };
                return (
                  <tr key={d.id}>
                    <td className="p-3">
                      <Link
                        href={`/admin/destinations/${d.id}/edit`}
                        className="font-medium hover:text-accent transition-colors"
                      >
                        {d.name}
                      </Link>
                      <p className="text-xs text-black/45 mt-0.5">{d.slug}</p>
                    </td>
                    <td className="p-3 text-black/70">{d.region ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{c.listings}</td>
                    <td className="p-3 text-right tabular-nums">{c.rentals}</td>
                    <td className="p-3 text-right tabular-nums">{c.blog_posts}</td>
                    <td className="p-3">
                      {d.published ? (
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-widest px-1.5 py-0.5">
                          Published
                        </span>
                      ) : (
                        <span className="inline-block bg-black/[0.06] text-black/55 text-[10px] uppercase tracking-widest px-1.5 py-0.5">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <DestinationRowActions destination={d} counts={c} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
