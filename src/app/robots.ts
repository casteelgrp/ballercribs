import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// Auto-exposed as /robots.txt. Keeps crawlers out of admin + API while
// leaving everything public-facing fully indexable.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
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
