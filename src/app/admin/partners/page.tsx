import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { countListingsByPartner, getAllPartners } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { affiliate: "Affiliate", direct: "Direct" };
const MODE_LABEL = {
  outbound_link: "Outbound link",
  inquiry_form: "Inquiry form"
};

export default async function AdminPartnersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.must_change_password) redirect("/admin/account?force=1");
  if (user.role !== "owner") notFound();

  const [partners, rentalCounts] = await Promise.all([
    getAllPartners().catch(() => []),
    countListingsByPartner().catch(() => ({} as Record<string, number>))
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-baseline justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Booking partners</h2>
          <p className="text-sm text-black/55 mt-1 max-w-xl">
            Affiliate or direct partners that fulfill rental bookings. Each
            rental on the site is attributed to one partner — that drives
            both the public booking block and inquiry forwarding.
          </p>
        </div>
        <Link
          href="/admin/partners/new"
          className="bg-ink text-paper px-5 py-2 text-sm uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
        >
          + New partner
        </Link>
      </div>

      {partners.length === 0 ? (
        <div className="border border-dashed border-black/20 py-16 text-center text-black/55">
          <p>No partners yet.</p>
          <p className="text-xs mt-2">Create one to attach rentals to it.</p>
        </div>
      ) : (
        <div className="border border-black/10 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.03] text-[10px] uppercase tracking-widest text-black/55">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">CTA mode</th>
                <th className="text-right p-3">Rentals</th>
                <th className="text-left p-3">Active</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {partners.map((p) => {
                const count = rentalCounts[p.id] ?? 0;
                return (
                  <tr key={p.id}>
                    <td className="p-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-black/45 mt-0.5">{p.slug}</p>
                    </td>
                    <td className="p-3">{TYPE_LABEL[p.type]}</td>
                    <td className="p-3">{MODE_LABEL[p.cta_mode]}</td>
                    <td className="p-3 text-right tabular-nums">{count}</td>
                    <td className="p-3">
                      {p.active ? (
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-widest px-1.5 py-0.5">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block bg-black/[0.06] text-black/55 text-[10px] uppercase tracking-widest px-1.5 py-0.5">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/partners/${p.id}/edit`}
                        className="text-xs uppercase tracking-widest hover:text-accent"
                      >
                        Edit →
                      </Link>
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
