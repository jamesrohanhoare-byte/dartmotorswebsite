import { supabasePublic as supabase } from "@/lib/supabase/public";
import type { SiteStock } from "@/lib/types";
import { isWithinSoldGrace } from "@/lib/stock/soldGrace";

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

/**
 * One car for its OWN page, including a recently-sold one.
 *
 * ⚠️ The only read in this file that can return a sold row, and it is only ever
 * used by shop/[slug] for the page that IS that car. Every listing read above
 * stays status='available', so a sold car still never appears in a grid, the
 * featured row, the related row or the sitemap.
 *
 * Why it exists: the Meta catalog keeps a sold car for SOLD_GRACE_DAYS so a
 * ViewContent fired before the sale still resolves, which means Meta is running
 * ads pointing at that url. Until 2026-09-25 that url returned 404 for all 28 of
 * them: paid clicks landing on an error, and the kind of dead link Commerce
 * Manager disapproves items for. The page now renders, clearly marked sold, for
 * exactly as long as the feed is still advertising it. One function decides
 * "still ours to serve" for both sides — see lib/stock/soldGrace.ts.
 */
export async function getStockBySlugAllowingSold(
  slug: string,
): Promise<{ vehicle: SiteStock; sold: boolean } | null> {
  const { data, error } = await supabase
    .from("site_stock")
    .select("*")
    .eq("slug", slug)
    .in("status", ["available", "sold"])
    .maybeSingle();
  if (error || !data) return null;

  const vehicle = data as SiteStock;
  if (vehicle.status !== "sold") return { vehicle, sold: false };
  // Past the window the feed has dropped it too, so there is no advertising
  // pointing here any more and a 404 is the honest answer again.
  return isWithinSoldGrace(vehicle) ? { vehicle, sold: true } : null;
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
