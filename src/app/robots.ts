import type { MetadataRoute } from "next";
import { dealer } from "@/config/dealer";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api"] },
    sitemap: `${dealer.siteUrl}/sitemap.xml`,
  };
}
