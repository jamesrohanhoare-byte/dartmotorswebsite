import { supabasePublic as supabase } from "@/lib/supabase/public";
import type { SiteStock } from "@/lib/types";

// All public reads go through the cookie-free anon client so pages render
// statically (ISR). RLS grants anon SELECT on site_stock only.

/** All available stock — featured first, then priciest. */
export async function getAvailableStock(): Promise<SiteStock[]> {
  const { data, error } = await supabase
    .from("site_stock")
    .select("*")
    .eq("status", "available")
    .order("featured", { ascending: false })
    .order("price", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("getAvailableStock:", error.message);
    return [];
  }
  return (data ?? []) as SiteStock[];
}

/** Featured cars for the homepage (falls back to newest available). */
export async function getFeaturedStock(limit = 3): Promise<SiteStock[]> {
  const all = await getAvailableStock();
  const featured = all.filter((v) => v.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function getStockBySlug(slug: string): Promise<SiteStock | null> {
  const { data, error } = await supabase
    .from("site_stock")
    .select("*")
    .eq("slug", slug)
    .eq("status", "available")
    .maybeSingle();
  if (error || !data) return null;
  return data as SiteStock;
}

/** More available stock, excluding one slug — for the "you may also like" row. */
export async function getRelatedStock(excludeSlug: string, limit = 8): Promise<SiteStock[]> {
  const all = await getAvailableStock();
  return all.filter((v) => v.slug !== excludeSlug).slice(0, limit);
}

/** All available slugs — for generateStaticParams + sitemap. */
export async function getAllStockSlugs(): Promise<string[]> {
  const { data } = await supabase
    .from("site_stock")
    .select("slug")
    .eq("status", "available");
  return (data ?? []).map((r) => r.slug as string);
}
