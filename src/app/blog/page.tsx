import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  getCategories,
  getFeaturedPost,
  getPublishedPostCount,
  getPublishedPosts
} from "@/lib/blog-queries";
import type { BlogPostListItem, PostCategory } from "@/types/blog";
import { JsonLd, breadcrumbListSchema } from "@/lib/jsonld";
import { BlogCard } from "@/components/BlogCard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BallerCribs Blog",
  description:
    "Guides, case studies, and destinations from the BallerCribs editorial team — luxury real estate, mansion rentals, and markets worth knowing.",
  openGraph: {
    type: "website",
    url: "/blog",
    title: "The BallerCribs Blog",
    description:
      "Guides, case studies, and destinations from the BallerCribs editorial team."
  },
  twitter: {
    card: "summary_large_image",
    title: "The BallerCribs Blog",
    description:
      "Guides, case studies, and destinations from the BallerCribs editorial team."
  },
  alternates: { canonical: "/blog" }
};

const PAGE_SIZE = 12;

export default async function BlogIndexPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const pageRaw = Number(sp.page);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const [categories, featuredRaw, totalCount, posts] = await Promise.all([
    getCategories().catch(() => [] as PostCategory[]),
    getFeaturedPost().catch(() => null),
    getPublishedPostCount({ category: category || undefined }).catch(() => 0),
    getPublishedPosts({
      category: category || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    }).catch(() => [] as BlogPostListItem[])
  ]);

  // Featured hero renders when: no filter is active, OR the active
  // filter matches the featured post's category. An out-of-category
  // hero above a filtered grid reads as a bug, so suppress it in that
  // case. (Reverses the D1 behavior that suppressed on any filter —
  // D2 intentionally keeps the hero in-view inside matching categories
  // so "Guides" viewers still see the merchandising headline.)
  const featured =
    featuredRaw && (!category || featuredRaw.categorySlug === category)
      ? featuredRaw
      : null;

  // Exclude the featured post from the grid so it only appears once.
  // Only needed when the hero is actually rendering — when suppressed,
  // the featured row (if it's in the filtered set) stays in the grid.
  const gridPosts = featured ? posts.filter((p) => p.id !== featured.id) : posts;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const categoryLabel = new Map<string, string>(
    categories.map((c) => [c.slug, c.name])
  );

  // BreadcrumbList on the category-filtered view only — bare /blog is
  // already a top-level entry and doesn't benefit from a single-item
  // trail. Item URL includes the ?category= query string so the
  // breadcrumb resolves to itself (Home > Blog > Modern) instead of
  // pointing at /blog, which Google flags as redundant.
  const activeCategoryName = category
    ? categoryLabel.get(category) ?? null
    : null;

  function pageHref(n: number): string {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `/blog?${s}` : "/blog";
  }

  return (
    <article>
      {activeCategoryName && (
        <JsonLd
          data={breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
            {
              name: activeCategoryName,
              url: `/blog?category=${category}`
            }
          ])}
        />
      )}
      {/* Hero — featured post. Renders when no filter is active, or
          when the active filter matches the featured post's category
          (so "Guides" viewers still see the headline if the featured
          post is a Guide). Container matches the listings grid
          (max-w-7xl) since this is a merchandising surface, not a
          reading column. */}
      {featured && (
        <section className="border-b border-black/10">
          <Link
            href={`/blog/${featured.slug}`}
            className="block group max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:gap-12 items-center"
          >
            {featured.coverImageUrl ? (
              <div className="relative aspect-[4/3] overflow-hidden bg-black/5 order-first lg:order-last">
                <Image
                  src={featured.coverImageUrl}
                  alt={featured.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-black/5 flex items-center justify-center text-xs uppercase tracking-widest text-black/40 order-first lg:order-last">
                No cover
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-widest text-accent">
                {categoryLabel.get(featured.categorySlug) ?? featured.categorySlug}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.1] mt-3 group-hover:text-accent transition-colors">
                {featured.title}
              </h1>
              {featured.subtitle && (
                <p className="text-lg text-black/60 mt-3">{featured.subtitle}</p>
              )}
              {featured.excerpt && (
                <p className="text-black/70 mt-4 leading-relaxed">
                  {featured.excerpt}
                </p>
              )}
              <p className="mt-6 text-xs uppercase tracking-widest text-ink inline-flex items-center gap-2">
                Read article
                <span aria-hidden>→</span>
              </p>
            </div>
          </Link>
        </section>
      )}

      {/* Category filter pills + grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-8 flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-black/50">Blog</p>
            <h2 className="font-display text-2xl sm:text-3xl mt-2">
              {category
                ? categoryLabel.get(category) ?? "Latest"
                : featured
                  ? "More from the blog"
                  : "Latest"}
            </h2>
          </div>
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Category filter">
            <CategoryPill href="/blog" label="All" active={!category} />
            {categories.map((c) => (
              <CategoryPill
                key={c.slug}
                href={`/blog?category=${c.slug}`}
                label={c.name}
                active={category === c.slug}
              />
            ))}
          </div>
        </div>

        {gridPosts.length === 0 ? (
          <div className="border border-dashed border-black/15 py-20 text-center text-black/50">
            <p>Nothing here yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {gridPosts.map((post) => (
              <BlogCard
                key={post.id}
                post={post}
                categoryLabel={categoryLabel.get(post.categorySlug) ?? post.categorySlug}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-12 flex items-center justify-center gap-1 flex-wrap"
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={pageHref(n)}
                aria-current={n === page ? "page" : undefined}
                className={
                  "px-3 py-1.5 text-xs uppercase tracking-widest border transition-colors " +
                  (n === page
                    ? "bg-ink text-paper border-ink"
                    : "bg-white text-black/60 border-black/20 hover:border-black/40")
                }
              >
                {n}
              </Link>
            ))}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-1.5 text-xs uppercase tracking-widest border bg-white text-black/60 border-black/20 hover:border-black/40 transition-colors"
              >
                Next →
              </Link>
            )}
          </nav>
        )}
      </section>
    </article>
  );
}

function CategoryPill({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      role="tab"
      aria-selected={active}
      className={
        "text-xs uppercase tracking-widest px-3 py-1.5 border transition-colors " +
        (active
          ? "bg-ink text-paper border-ink"
          : "bg-white text-black/60 border-black/20 hover:border-black/40")
      }
    >
      {label}
    </Link>
  );
}

