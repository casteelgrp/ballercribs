import Image from "next/image";
import Link from "next/link";
import type { BlogPostListItem } from "@/types/blog";
import { formatDisplayDate } from "@/lib/blog-dates";

/**
 * Public-facing blog post card. Extracted from the /blog index so the
 * homepage can mount the same visual in its "Latest from the blog"
 * section. Props are a BlogPostListItem (the narrow shape getPublishedPosts
 * returns) plus a human category label — callers resolve the slug →
 * name map once per page, not per card.
 *
 * Date rendering goes through formatDisplayDate so the card honors the
 * "Updated <date>" rule for editorially-refreshed posts (>24h after
 * publish) — same treatment as the detail page byline.
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
          {formatDisplayDate(post)}
          {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ""}
        </p>
      </div>
    </Link>
  );
}
