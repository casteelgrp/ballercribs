import type { Metadata } from "next";
import { getSoldListings } from "@/lib/db";
import { ListingCard } from "@/components/ListingCard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Recently Sold — BallerCribs",
  description:
    "Properties we've featured that have since sold. A running record of the luxury market we cover."
};

export default async function SoldPage() {
  let listings: Awaited<ReturnType<typeof getSoldListings>> = [];
  try {
    listings = await getSoldListings();
  } catch {
    listings = [];
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-black/50">Archive</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Recent BallerCribs sales</h1>
        <p className="text-black/60 mt-3 max-w-2xl">
          Properties we've featured that have since sold. A running record of the market we cover.
        </p>
      </div>

      {listings.length === 0 ? (
        <div className="border border-dashed border-black/20 py-24 text-center text-black/50">
          <p>No sold listings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
