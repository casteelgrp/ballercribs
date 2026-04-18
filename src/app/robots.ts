import type { MetadataRoute } from "next";

// Auto-exposed as /robots.txt. Keeps crawlers out of admin + API while
// leaving everything public-facing fully indexable.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ballercribs.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api"]
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
