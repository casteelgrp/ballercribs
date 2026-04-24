import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getActiveHeroPhotos,
  getFeaturedListings,
  getHomepageRentals
} from "@/lib/db";
import { getCategories, getPublishedPosts } from "@/lib/blog-queries";
import { ListingCard } from "@/components/ListingCard";
import { BlogCard } from "@/components/BlogCard";
import { HeroCarousel } from "@/components/HeroCarousel";
import { NewsletterCTA } from "@/components/NewsletterCTA";

export const revalidate = 60;

// Homepage uses the root-layout default title + description (no override) —
// this metadata block exists only to pin the canonical URL, which must be
// per-page rather than inherited from the root layout.
export const metadata: Metadata = {
  alternates: { canonical: "/" }
};

export default async function HomePage() {
  // Fetch all homepage data in parallel. All four reads are best-effort
  // — DB hiccups shouldn't take down the homepage. The blog/rentals
  // sections render empty-state placeholders if their queries miss.
  const [listings, heroPhotos, blogPosts, categories, rentals] = await Promise.all([
    getFeaturedListings(6).catch(() => []),
    getActiveHeroPhotos().catch(() => []),
    getPublishedPosts({ limit: 3 }).catch(() => []),
    getCategories().catch(() => []),
    getHomepageRentals(3).catch(() => [])
  ]);

  // Category-slug → display-name lookup for blog card eyebrows. Built
  // once per render — blog cards don't need to re-resolve.
  const categoryLabel = new Map(categories.map((c) => [c.slug, c.name]));

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
          {/* Secondary "For agents" path sits to the left of the primary
              "View all" — "View all" stays right-most to preserve the
              existing muscle memory for buyers clicking through.
              Separator rule matches SiteHeader's nav-divider pattern. */}
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/agents"
              className="hover:text-accent underline underline-offset-4"
            >
              For agents →
            </Link>
            <span className="h-4 w-px bg-black/20" aria-hidden="true" />
            <Link
              href="/listings"
              className="hover:text-accent underline underline-offset-4"
            >
              View all →
            </Link>
          </div>
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

      {/* Latest from the blog — bg-white gives a crisp tonal step
          against the body cream (#fafaf7). Centered header + CTA-below-
          grid breaks the three-sections-stacked repetition of
          left-aligned eyebrow + top-right link; listings and rentals
          keep the parallel left-aligned treatment since they're both
          product catalogs. Hidden entirely when no published posts
          exist yet. */}
      {blogPosts.length > 0 && (
        <section className="bg-white border-t border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
            <div className="text-center mb-10">
              <p className="text-xs uppercase tracking-widest text-black/50">Blog</p>
              <h2 className="font-display text-3xl sm:text-4xl mt-2">
                Latest from the blog
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {blogPosts.map((post) => (
                <BlogCard
                  key={post.id}
                  post={post}
                  categoryLabel={
                    categoryLabel.get(post.categorySlug) ?? post.categorySlug
                  }
                />
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/blog"
                className="text-sm hover:text-accent underline underline-offset-4"
              >
                View all posts →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured rentals — dark section, unifies with the For Agents
          band below as the page's two dark anchors. py-12 sm:py-16
          trims mobile vertical weight (dark fills more viewport on
          phones). The `.dark-rental-card` wrapper re-skins the shared
          ListingCard's cream-mode colors for this section only —
          card component stays pristine (see globals.css). */}
      {rentals.length > 0 && (
        <section className="bg-ink text-paper">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs uppercase tracking-widest text-paper/50">
                  Rentals
                </p>
                <h2 className="font-display text-3xl sm:text-4xl mt-2 text-paper">
                  Featured rentals
                </h2>
              </div>
              <Link
                href="/rentals"
                className="text-sm text-paper hover:text-accent underline underline-offset-4 decoration-paper/40 hover:decoration-accent"
              >
                Browse rentals →
              </Link>
            </div>
            <div className="dark-rental-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {rentals.map((rental) => (
                <ListingCard key={rental.id} listing={rental} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter — mid-funnel invite between the editorial grid and the
          agent CTA. Full-width band keeps it feeling like a magazine
          section break rather than a marketing pop-up. */}
      <NewsletterCTA variant="full" />

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
            Put your listing in front of millions.
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
