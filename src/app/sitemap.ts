import type { MetadataRoute } from "next";
import { getAllListings } from "@/lib/db";

// Next.js auto-exposes this as /sitemap.xml. Rebuilt on every request
// unless we add a revalidate — leaving dynamic so a newly-published
// listing shows up immediately without waiting on ISR.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";

  // getAllListings returns all status='published' rows — including sold ones,
  // which we intentionally keep indexed for SEO + history.
  const listings = await getAllListings().catch(() => []);

  const listingRoutes: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${baseUrl}/listings/${l.slug}`,
    // If sold, the sold date is a more honest "last changed" signal than updated_at.
    lastModified: new Date(l.sold_at || l.updated_at || l.created_at),
    changeFrequency: l.sold_at ? "yearly" : "weekly",
    priority: l.sold_at ? 0.5 : 0.8
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
      url: `${baseUrl}/sold`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6
    },
    {
      url: `${baseUrl}/newsletter`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${baseUrl}/agents`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    }
  ];

  return [...staticRoutes, ...listingRoutes];
}
