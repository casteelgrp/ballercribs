import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCategories, getPostBySlug } from "@/lib/blog-queries";
import { getUserById } from "@/lib/db";
import { NewsletterCTA } from "@/components/NewsletterCTA";

export const revalidate = 60;

function formatPublishedAt(d: Date | null): string {
  if (!d) return "";
  const iso = d.toISOString();
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[m - 1]} ${day}, ${y}`;
}

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
  const images = post.socialCoverUrl
    ? [post.socialCoverUrl]
    : post.coverImageUrl
      ? [post.coverImageUrl]
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
      images
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
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
  if (!post) notFound();

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
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(descriptionForSchema && { description: descriptionForSchema }),
    ...(imageForSchema && { image: [imageForSchema] }),
    ...(post.publishedAt && { datePublished: post.publishedAt.toISOString() }),
    ...(post.updatedAt && { dateModified: post.updatedAt.toISOString() }),
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
      {post.coverImageUrl && (
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-black/5">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
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
        <Link
          href="/blog"
          className="text-xs uppercase tracking-widest text-black/50 hover:text-accent"
        >
          ← Back to blog
        </Link>

        <p className="text-xs uppercase tracking-widest text-accent mt-6">
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
          <span>{formatPublishedAt(post.publishedAt)}</span>
          {post.readingTimeMinutes && (
            <>
              <span aria-hidden>·</span>
              <span>{post.readingTimeMinutes} min read</span>
            </>
          )}
        </p>

        <div className="mt-8">
          {hasBody ? (
            <div
              className="blog-prose"
              // body_html is sanitized server-side by DOMPurify at write
              // time (POST + PATCH routes in /api/admin/blog/posts).
              dangerouslySetInnerHTML={{ __html: post.bodyHtml as string }}
            />
          ) : (
            <p className="text-black/50 italic">No content yet.</p>
          )}
        </div>

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

        {/* CompactShell renders its own pt-8 + top border, so just drop it
            at the end of the reading column. */}
        <div className="mt-8">
          <NewsletterCTA variant="compact" />
        </div>
      </div>
    </article>
  );
}
