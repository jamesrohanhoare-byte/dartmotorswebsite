import { supabasePublic as supabase } from "@/lib/supabase/public";
import type { SiteStock } from "@/lib/types";

/**
 * Stock for the Meta catalog feed — the ONLY read in the codebase that returns
 * sold rows.
 *
 * ⚠️ Deliberately NOT in queries.ts. Every read in that file filters to
 * status='available' because a sold car must never appear on the website. This
 * query breaks that rule on purpose: Meta needs recently-sold cars present but
 * marked unavailable, so a past ViewContent can still be attributed while the
 * car is never served. Quarantining it in its own file makes an accidental
 * import obvious in review.
 */
export async function getStockForMetaFeed(): Promise<SiteStock[]> {
  const { data, error } = await supabase
    .from("site_stock")
    .select("*")
    .in("status", ["available", "sold"])
    .eq("source", "feed") // manual listings never belong in a VEHICLE catalog
    .order("status", { ascending: true }) // available first, purely for readability
    .order("price", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("getStockForMetaFeed:", error.message);
    return [];
  }
  return (data ?? []) as SiteStock[];
}
