import type { MetadataRoute } from "next";
import { getAllStockSlugs } from "@/lib/queries";
import { dealer } from "@/config/dealer";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = dealer.siteUrl;
  const slugs = await getAllStockSlugs();

  const staticPages = ["", "/shop", "/financing", "/about", "/contact"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const vehiclePages = slugs.map((slug) => ({
    url: `${base}/shop/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...vehiclePages];
}
