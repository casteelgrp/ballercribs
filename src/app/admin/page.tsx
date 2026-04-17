import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getAllListings, getRecentInquiries } from "@/lib/db";
import { NewListingForm } from "@/components/NewListingForm";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const [listings, inquiries] = await Promise.all([
    getAllListings().catch(() => []),
    getRecentInquiries(50).catch(() => [])
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <h1 className="font-display text-3xl">Admin</h1>
        <form action="/api/admin/logout" method="POST">
          <button
            type="submit"
            className="text-sm underline underline-offset-4 hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* New listing */}
      <section className="mb-16">
        <h2 className="font-display text-2xl mb-1">New listing</h2>
        <p className="text-sm text-black/60 mb-6">
          Paste image URLs from any host — Vercel Blob, Instagram, agent sites, etc.
        </p>
        <div className="border border-black/10 bg-white p-6">
          <NewListingForm />
        </div>
      </section>

      {/* Existing listings */}
      <section className="mb-16">
        <h2 className="font-display text-2xl mb-6">Listings ({listings.length})</h2>
        {listings.length === 0 ? (
          <p className="text-black/50 text-sm">No listings yet.</p>
        ) : (
          <div className="border border-black/10 bg-white divide-y divide-black/10">
            {listings.map((l) => (
              <div key={l.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/listings/${l.slug}`} className="font-medium hover:text-accent truncate block">
                    {l.title}
                    {l.featured && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest bg-accent text-ink px-1.5 py-0.5">
                        Featured
                      </span>
                    )}
                  </Link>
                  <p className="text-xs text-black/60">{l.location}</p>
                </div>
                <div className="text-sm text-accent font-medium">
                  {formatPrice(l.price_usd)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent inquiries */}
      <section>
        <h2 className="font-display text-2xl mb-6">Recent inquiries ({inquiries.length})</h2>
        {inquiries.length === 0 ? (
          <p className="text-black/50 text-sm">No inquiries yet.</p>
        ) : (
          <div className="border border-black/10 bg-white divide-y divide-black/10">
            {inquiries.map((i) => (
              <div key={i.id} className="p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <a href={`mailto:${i.email}`} className="text-sm text-accent hover:underline">
                      {i.email}
                    </a>
                    {i.phone && <span className="text-sm text-black/60 ml-2">· {i.phone}</span>}
                  </div>
                  <p className="text-xs text-black/50 shrink-0">
                    {new Date(i.created_at).toLocaleString()}
                  </p>
                </div>
                {i.listing_title && (
                  <p className="text-sm text-black/70 mt-2">
                    Re: <span className="font-medium">{i.listing_title}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {i.timeline && (
                    <span className="bg-black/5 px-2 py-1">Timeline: {i.timeline.replace(/_/g, " ")}</span>
                  )}
                  {i.pre_approved && (
                    <span className="bg-accent/20 text-accent px-2 py-1">Pre-approved</span>
                  )}
                </div>
                {i.message && (
                  <p className="text-sm text-black/80 mt-3 whitespace-pre-wrap">{i.message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
