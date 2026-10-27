import type { MetadataRoute } from "next";
import { isProduction, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/my-account/", "/post-an-ad/", "/admin/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
