import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getDestinationBySlug,
  getListingsByDestination
} from "@/lib/db";
import { getCategories, getPostsByDestination } from "@/lib/blog-queries";
import { JsonLd, breadcrumbListSchema } from "@/lib/jsonld";
import { ListingCard } from "@/components/ListingCard";
import { BlogCard } from "@/components/BlogCard";
import type { Destination } from "@/lib/types";

export const revalidate = 60;

const SEO_DESC_MAX = 160;

function buildSeoTitle(d: Destination): string {
  return d.seo_title?.trim()
    ? d.seo_title.trim()
    : `${d.name} — Luxury Homes & Rentals | BallerCribs`;
}

function buildSeoDescription(d: Destination): string {
  if (d.seo_description?.trim()) return d.seo_description.trim();
  if (d.blurb?.trim()) {
    const t = d.blurb.trim();
    return t.length > SEO_DESC_MAX
      ? t.slice(0, SEO_DESC_MAX - 1).trimEnd() + "…"
      : t;
  }
  return `Curated luxury listings and rentals in ${d.display_name}. Mansions, estates, and architectural icons from BallerCribs.`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug).catch(() => null);
  if (!destination || !destination.published) {
    // Suppressed metadata — Next.js falls back to the parent template.
    return { title: "Destination not found" };
  }
  const title = buildSeoTitle(destination);
  const description = buildSeoDescription(destination);
  const canonical = `/destinations/${destination.slug}`;
  const ogImage = destination.hero_image_url || "/opengraph-image";
  return {
    // Absolute title (overrides root template) — fallback already
    // includes "| BallerCribs", and admins writing seo_title own the
    // brand suffix decision.
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      images: [ogImage]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage]
    }
  };
}

export default async function DestinationDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug).catch(() => null);
  if (!destination || !destination.published) notFound();

  const [sales, rentals, stories, categories] = await Promise.all([
    getListingsByDestination(destination.id, "sale").catch(() => []),
    getListingsByDestination(destination.id, "rental").catch(() => []),
    getPostsByDestination(destination.id).catch(() => []),
    getCategories().catch(() => [])
  ]);

  const categoryLabel = new Map(categories.map((c) => [c.slug, c.name]));
  const isEmpty = sales.length === 0 && rentals.length === 0 && stories.length === 0;

  return (
    <article>
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Destinations", url: "/destinations" },
          {
            name: destination.name,
            url: `/destinations/${destination.slug}`
          }
        ])}
      />

      {/* Hero — full-width image when present, muted ink panel otherwise.
          Shape mirrors /rentals' hero (ink + tagline) so a destination
          without imagery still reads as an editorial header rather
          than a raw text block. */}
      {destination.hero_image_url ? (
        <section className="relative">
          <div className="relative min-h-[22rem] sm:min-h-0 sm:aspect-[16/6] bg-black/10 overflow-hidden">
            <Image
              src={destination.hero_image_url}
              alt={destination.hero_image_alt || destination.display_name}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 sm:pb-14 text-paper">
                <p className="text-xs uppercase tracking-widest text-paper/70">
                  Destination
                </p>
                <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl mt-2 leading-[1.05]">
                  {destination.display_name}
                </h1>
                {destination.blurb && (
                  <p className="mt-4 text-paper/85 max-w-2xl text-lg leading-relaxed">
                    {destination.blurb}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-ink text-paper">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <p className="text-xs uppercase tracking-widest text-accent">Destination</p>
            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl mt-2 leading-[1.05]">
              {destination.display_name}
            </h1>
            {destination.blurb && (
              <p className="mt-4 text-paper/80 max-w-2xl text-lg leading-relaxed">
                {destination.blurb}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Section rhythm mirrors the homepage: cream listings → dark
          rentals (with the dark-rental-card wrapper that re-skins
          ListingCard for the ink surface) → bg-white blog. Each
          section sits in its own <section> with its own bg + top
          border, so the visual separation is structural rather than
          a decorative <hr>. */}

      {sales.length > 0 && (
        <section className="border-t border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 className="font-display text-2xl sm:text-3xl mb-6">
              Listings in {destination.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {sales.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {rentals.length > 0 && (
        <section className="bg-ink text-paper">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 className="font-display text-2xl sm:text-3xl mb-6 text-paper">
              Rentals in {destination.name}
            </h2>
            <div className="dark-rental-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {rentals.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}

      {stories.length > 0 && (
        <section className="bg-white border-t border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 className="font-display text-2xl sm:text-3xl mb-6">From the Blog</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {stories.map((post) => (
                <BlogCard
                  key={post.id}
                  post={post}
                  categoryLabel={categoryLabel.get(post.categorySlug) ?? post.categorySlug}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {isEmpty && (
        <section className="border-t border-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="border border-dashed border-black/15 py-16 px-6 text-center">
              <p className="text-black/70 max-w-xl mx-auto">
                We&apos;re working on coverage for {destination.name}. In the
                meantime, browse all listings or all rentals.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/listings"
                  className="bg-ink text-paper px-5 py-2 text-xs uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors"
                >
                  Browse listings
                </Link>
                <Link
                  href="/rentals"
                  className="border border-black/20 px-5 py-2 text-xs uppercase tracking-widest hover:border-black/50 transition-colors"
                >
                  Browse rentals
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
