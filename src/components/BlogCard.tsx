import Image from "next/image";
import Link from "next/link";
import type { BlogPostListItem } from "@/types/blog";

/**
 * Public-facing blog post card. Extracted from the /blog index so the
 * homepage can mount the same visual in its "Latest from the blog"
 * section. Props are a BlogPostListItem (the narrow shape getPublishedPosts
 * returns) plus a human category label — callers resolve the slug →
 * name map once per page, not per card.
 *
 * formatPublishedAt is local on purpose: the helper is duplicated by
 * the /blog detail page byline and the admin search — worth a
 * /lib/format extraction only once a fourth caller needs it.
 */
export function BlogCard({
  post,
  categoryLabel
}: {
  post: BlogPostListItem;
  categoryLabel: string;
}) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.coverImageAlt || post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-black/40">
            No cover
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-widest text-accent">
          {categoryLabel}
        </p>
        <h3 className="font-display text-xl leading-tight mt-1.5 line-clamp-2 group-hover:text-accent transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 text-sm text-black/65 line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <p className="mt-3 text-xs text-black/45">
          {formatPublishedAt(post.publishedAt)}
          {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ""}
        </p>
      </div>
    </Link>
  );
}

function formatPublishedAt(d: Date | null): string {
  if (!d) return "";
  // UTC components so the stamp doesn't drift across TZs — same
  // approach used by the blog detail page byline.
  const iso = d.toISOString();
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[m - 1]} ${day}, ${y}`;
}
