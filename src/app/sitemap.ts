import type { MetadataRoute } from "next";
import { getListings, getRentalListings } from "@/lib/db";
import { getPublishedPostSitemapEntries } from "@/lib/blog-queries";

// Next.js auto-exposes this as /sitemap.xml. Rebuilt on every request
// unless we add a revalidate — leaving dynamic so a newly-published
// listing shows up immediately without waiting on ISR.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";

  const [saleListings, rentalListings, blogPosts] = await Promise.all([
    getListings("all").catch(() => []),
    getRentalListings().catch(() => []),
    getPublishedPostSitemapEntries().catch(() => [])
  ]);

  const listingRoutes: MetadataRoute.Sitemap = saleListings.map((l) => ({
    url: `${baseUrl}/listings/${l.slug}`,
    // If sold, the sold date is a more honest "last changed" signal than updated_at.
    lastModified: new Date(l.sold_at || l.updated_at || l.created_at),
    changeFrequency: l.sold_at ? "yearly" : "weekly",
    priority: l.sold_at ? 0.5 : 0.8
  }));

  const rentalRoutes: MetadataRoute.Sitemap = rentalListings.map((l) => ({
    url: `${baseUrl}/rentals/${l.slug}`,
    lastModified: new Date(l.updated_at || l.created_at),
    changeFrequency: "weekly",
    priority: 0.75
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6
  }));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    {
      url: `${baseUrl}/listings`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${baseUrl}/newsletter`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${baseUrl}/agents`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${baseUrl}/rentals`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7
    },
    // Blog index sits slightly above the individual article priority
    // since it's a crawl entry point that links to every post.
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7
    },
    // Legal pages — indexable for trust + search compliance, but low
    // priority since they're supporting content, not the site's reason to
    // exist. Updated only when we revise the policy text itself.
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${baseUrl}/referral-disclosure`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];

  return [...staticRoutes, ...listingRoutes, ...rentalRoutes, ...blogRoutes];
}
