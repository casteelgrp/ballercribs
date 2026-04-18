import Image from "next/image";
import Link from "next/link";
import { getActiveHeroPhotos, getFeaturedListings } from "@/lib/db";
import { ListingCard } from "@/components/ListingCard";
import { HeroCarousel } from "@/components/HeroCarousel";

export const revalidate = 60;

export default async function HomePage() {
  // Fetch listings + hero photos in parallel. Both are best-effort — DB hiccups
  // shouldn't take down the homepage.
  const [listings, heroPhotos] = await Promise.all([
    getFeaturedListings(6).catch(() => []),
    getActiveHeroPhotos().catch(() => [])
  ]);

  return (
    <>
      {/* Hero — photo carousel when curated photos exist, else the original
          text-on-cream block (two-tier fallback per spec). */}
      {heroPhotos.length > 0 ? (
        <HeroCarousel photos={heroPhotos} />
      ) : (
        <section className="border-b border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
              The wildest luxury homes
              <br />
              <span className="text-accent">on the internet.</span>
            </h1>
            <p className="mt-6 text-lg text-black/70 max-w-2xl mx-auto">
              Curated mega-mansions, architectural icons, and estates you won't find on Zillow.
              Seen by millions on Instagram — now with direct lines to the agents.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/listings"
                className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
              >
                Browse listings
              </Link>
              <Link
                href="/newsletter"
                className="border border-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
              >
                Get the newsletter
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-black/50">Featured</p>
            <h2 className="font-display text-3xl sm:text-4xl mt-2">Latest listings</h2>
          </div>
          <Link href="/listings" className="text-sm hover:text-accent underline underline-offset-4">
            View all →
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="border border-dashed border-black/20 py-16 text-center text-black/50">
            <p>No listings yet. Check back soon.</p>
            <p className="text-xs mt-2">
              (Admin: add your first listing at <code>/admin</code>)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* For agents CTA */}
      <section className="bg-ink text-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
          <Image
            src="/logo-white.png"
            alt="BallerCribs"
            width={400}
            height={80}
            className="h-20 w-auto mx-auto mb-6"
          />
          <p className="text-xs uppercase tracking-widest text-accent">For agents</p>
          <h2 className="font-display text-3xl sm:text-4xl mt-3">
            Put your listing in front of 300K+ followers and millions of monthly viewers.
          </h2>
          <p className="mt-4 text-paper/70 max-w-2xl mx-auto">
            Seen by millions every month across Instagram, Facebook, and TikTok. Featured
            placements include a carousel post, a Reel, a dedicated listing page, and direct buyer
            inquiries.
          </p>
          <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
            <Link
              href="/agents"
              className="inline-block bg-accent text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-paper transition-colors"
            >
              Get featured
            </Link>
            <a
              href="mailto:theballercribs@gmail.com?subject=Featured%20listing%20inquiry"
              className="text-sm text-paper/70 hover:text-paper underline underline-offset-4"
            >
              Or email us directly
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
