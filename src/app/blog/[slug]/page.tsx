import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getBlogRedirectByOldSlug,
  getCategories,
  getPostBySlug
} from "@/lib/blog-queries";
import { getUserById } from "@/lib/db";
import { JsonLd, breadcrumbListSchema, faqPageSchema } from "@/lib/jsonld";
import { formatDisplayDate, getDisplayDate } from "@/lib/blog-dates";
import { BlogBody } from "@/components/BlogBody";
import { BlogFaqs } from "@/components/BlogFaqs";
import { NewsletterCTA } from "@/components/NewsletterCTA";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  // Non-published slugs disappear from SERPs entirely — better than
  // "this post doesn't exist" 404 metadata leaking into the index.
  if (!post) return { robots: { index: false } };

  const title = post.metaTitle?.trim() || post.title;
  const description =
    post.metaDescription?.trim() || post.excerpt?.trim() || undefined;
  // OG image source: socialCoverUrl wins (purpose-built 1200x630), then
  // coverImageUrl, else nothing. Alt only emits when coverImageAlt is
  // explicitly set — title already lives in og:title, so falling back
  // there would render as duplicate noise to a screen-reader user
  // landing on a Facebook/LinkedIn share preview.
  const imageUrl = post.socialCoverUrl || post.coverImageUrl || null;
  const ogImages = imageUrl
    ? post.coverImageAlt?.trim()
      ? [{ url: imageUrl, alt: post.coverImageAlt.trim() }]
      : [imageUrl]
    : [];

  return {
    // absolute → no "| BallerCribs" suffix so the article title owns the
    // tab + search result cleanly. Matches the listing + rental pattern.
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: ogImages
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages
    },
    alternates: { canonical: `/blog/${post.slug}` }
  };
}

export default async function BlogDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post) {
    // Slug miss — check if this URL was retired into a redirect
    // before 404'ing. permanentRedirect emits a 308; Google treats 308
    // and 301 equivalently for ranking transfer, so external backlinks
    // and Search index entries pointing at the old URL keep their
    // signal once the redirect chain resolves to the live post.
    // (Next.js 15 split the navigation API: redirect() = 307,
    // permanentRedirect() = 308. RedirectType.push/replace controls
    // client navigation behavior, not HTTP status — different axis.)
    const newSlug = await getBlogRedirectByOldSlug(slug).catch(() => null);
    if (newSlug && newSlug !== slug) {
      permanentRedirect(`/blog/${newSlug}`);
    }
    notFound();
  }

  // getPostBySlug's default includeUnpublished=false means we're always
  // looking at a status='published' row here — the JSON-LD below emits
  // unconditionally on that structural invariant (no extra gate needed).
  const [categories, author] = await Promise.all([
    getCategories().catch(() => []),
    post.authorUserId !== null
      ? getUserById(post.authorUserId).catch(() => null)
      : Promise.resolve(null)
  ]);
  const categoryName =
    categories.find((c) => c.slug === post.categorySlug)?.name ?? post.categorySlug;

  // Fallback when body_html somehow missed the save path (e.g. a legacy
  // row or a pre-migration seed) — render a neutral placeholder rather
  // than blank-space-with-no-explanation.
  const hasBody = Boolean(post.bodyHtml && post.bodyHtml.trim());

  // BlogPosting is a subtype of Article that Google's rich-result
  // parsers treat distinctly from news articles — more specific match
  // without widening the field set. Spread-if-present pattern keeps
  // nulls out of the final JSON so schema validators stay happy.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
  const descriptionForSchema =
    post.metaDescription?.trim() || post.excerpt?.trim() || undefined;
  const imageForSchema = post.socialCoverUrl || post.coverImageUrl || undefined;
  // Promote image to ImageObject when we have alt text — Google uses
  // ImageObject.description as image-search context, distinct from the
  // post headline. Bare URL is the legacy shape and stays valid when no
  // alt is set (existing posts pre-018 fall through this path).
  const trimmedCoverAlt = post.coverImageAlt?.trim() || null;
  const schemaImage = imageForSchema
    ? trimmedCoverAlt
      ? [{ "@type": "ImageObject", url: imageForSchema, description: trimmedCoverAlt }]
      : [imageForSchema]
    : null;
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(descriptionForSchema && { description: descriptionForSchema }),
    ...(schemaImage && { image: schemaImage }),
    ...(post.publishedAt && { datePublished: post.publishedAt.toISOString() }),
    // dateModified now reflects editorial refresh (last_updated_at)
    // when the >24h threshold passes; otherwise mirrors datePublished
    // — Google prefers the field present even when equal. Auto-bumped
    // updated_at is intentionally NOT used here, since it fires on
    // every typo fix and would lie about content freshness.
    ...(post.publishedAt && {
      dateModified: (
        getDisplayDate({
          publishedAt: post.publishedAt,
          lastUpdatedAt: post.lastUpdatedAt
        })?.date ?? post.publishedAt
      ).toISOString()
    }),
    ...(author?.name && {
      author: { "@type": "Person", name: author.name }
    }),
    publisher: {
      "@type": "Organization",
      name: "BallerCribs",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo-black.png`,
        width: 180,
        height: 36
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/blog/${post.slug}`
    }
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` }
        ])}
      />
      {/* FAQPage schema only emits when the post has structured FAQs.
          Empty / null leaves the head clean — Google's FAQ rich result
          requires actual Q+A markup, an empty schema would fail
          validation. */}
      {post.faqs && post.faqs.length > 0 && (
        <JsonLd data={faqPageSchema(post.faqs)} />
      )}
      {post.coverImageUrl && (
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-black/5">
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt || post.title}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </div>
      )}

      {/* Article column at max-w-5xl (1024px wrapper, 976px effective
          content after px-6 padding). Deliberately wider than the
          Medium/Substack reading-column convention — lands around 75%
          of a 1440px desktop viewport, which matches the editorial
          rhythm Jay wants for feature posts with inline property cards
          and images. The property card + hero-image spans benefit
          materially from the extra width. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Top "Back to blog" link removed — the category chip at the
            bottom of the article and the site nav already cover return
            paths. The footer back-link stays for readers who scroll to
            the end. */}
        <p className="text-xs uppercase tracking-widest text-accent">
          {categoryName}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.1] mt-3">
          {post.title}
        </h1>
        {post.subtitle && (
          <p className="text-lg sm:text-xl text-black/60 mt-4 leading-snug">
            {post.subtitle}
          </p>
        )}

        <p className="mt-6 text-xs uppercase tracking-widest text-black/50 flex items-center gap-3 border-b border-black/10 pb-6">
          <span>{formatDisplayDate(post)}</span>
          {post.readingTimeMinutes && (
            <>
              <span aria-hidden>·</span>
              <span>{post.readingTimeMinutes} min read</span>
            </>
          )}
        </p>

        <div className="mt-8">
          {hasBody ? (
            // BlogBody wraps the sanitized HTML and wires the gallery
            // lightbox via click delegation. Falls back gracefully on
            // bodies without galleries (listener attaches to nothing).
            <BlogBody html={post.bodyHtml as string} />
          ) : (
            <p className="text-black/50 italic">No content yet.</p>
          )}
        </div>

        {/* Structured FAQ section. Renders nothing when post.faqs is
            null/empty so the same JSX sits unconditionally; the
            FAQPage JSON-LD above gates separately so head + body
            stay in sync. */}
        <BlogFaqs faqs={post.faqs} />

        <div className="mt-12 pt-8 border-t border-black/10 flex items-center justify-between gap-4 flex-wrap">
          <Link
            href={`/blog?category=${post.categorySlug}`}
            className="text-xs uppercase tracking-widest bg-black/5 px-3 py-1.5 hover:bg-accent hover:text-ink transition-colors"
          >
            {categoryName}
          </Link>
          <Link
            href="/blog"
            className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
          >
            ← Back to blog
          </Link>
        </div>

      </div>

      {/* Full-bleed newsletter band — rendered OUTSIDE the 42rem reading
          column so the dark ink stretches edge-to-edge. context="article"
          drops the "Like this one?" prefix that only reads naturally on
          property detail pages. */}
      <NewsletterCTA variant="compact" context="article" />
    </article>
  );
}
