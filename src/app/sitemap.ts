import type { MetadataRoute } from "next";
import { getAllListings } from "@/lib/db";

// Next.js auto-exposes this as /sitemap.xml. Rebuilt on every request
// unless we add a revalidate — leaving dynamic so a newly-published
// listing shows up immediately without waiting on ISR.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";

  // getAllListings only returns status='published' rows — exactly what
  // we want in the public sitemap (no drafts leaking).
  const listings = await getAllListings().catch(() => []);

  const listingRoutes: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${baseUrl}/listings/${l.slug}`,
    lastModified: new Date(l.updated_at || l.created_at),
    changeFrequency: "weekly",
    priority: 0.8
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
