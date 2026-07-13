import { fetchVehicles } from "./fetchFeed";
import { createServiceClient } from "@/lib/supabase/service";

function toISO(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export interface SyncResult {
  fetched: number;
  upserted: number;
  archived: number;
  purged: number;
}

/**
 * Reconcile site_stock against the live VMG feed:
 *  - upsert every feed car by slug `stock-{id}` (insert new, update existing)
 *  - soft-delete: any still-available car no longer in the feed → status 'sold'
 * Ported from VMGFeedDartMotors/lib/syncToFramer.ts, targeting Supabase.
 */
export async function syncStock(): Promise<SyncResult> {
  const vehicles = await fetchVehicles();

  // Safety guard: never wipe stock on an empty/failed feed.
  if (vehicles.length === 0) {
    throw new Error("VMG feed returned 0 vehicles — aborting to avoid wiping stock");
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const rows = vehicles.map((v) => {
    const title = [v.year || null, v.make, v.variant].filter(Boolean).join(" ");
    return {
      slug: `stock-${v.stockID}`,
      stock_id: v.stockID,
      make: v.make,
      variant: v.variant || null,
      title: title || null,
      year: v.year || null,
      price: Math.round(v.price) || null,
      mileage: v.mileage || null,
      colour: v.colour || null,
      new_used: v.newUsed || null,
      condition: v.condition || null,
      extras: v.extras || null,
      description: v.description || null,
      reference_id: v.referenceID || null,
      date_updated: toISO(v.dateUpdated),
      images: v.images,
      status: "available" as const,
      // Featured is driven by VMG: any car set to "Excellent" condition in VMG
      // is automatically featured on the site. Dealer controls it from VMG Smart.
      featured: /excellent/i.test(v.condition || ""),
      synced_at: now,
    };
  });

  // Upsert (featured now reflects VMG condition on every sync).
  const { error: upErr } = await supabase.from("site_stock").upsert(rows, {
    onConflict: "slug",
  });
  if (upErr) throw new Error(`site_stock upsert failed: ${upErr.message}`);

  // Soft-delete stale: available rows whose slug is no longer in the feed.
  const feedSlugs = new Set(rows.map((r) => r.slug));
  const { data: liveRows, error: readErr } = await supabase
    .from("site_stock")
    .select("slug")
    .eq("status", "available");
  if (readErr) throw new Error(`site_stock read failed: ${readErr.message}`);

  const staleSlugs = (liveRows ?? [])
    .map((r) => r.slug as string)
    .filter((slug) => !feedSlugs.has(slug));

  let archived = 0;
  if (staleSlugs.length > 0) {
    const { error: archErr } = await supabase
      .from("site_stock")
      .update({ status: "sold" })
      .in("slug", staleSlugs);
    if (archErr) throw new Error(`site_stock archive failed: ${archErr.message}`);
    archived = staleSlugs.length;
  }

  // Retention: OFF by default. The dealer manages deletions by hand (a delete
  // button in Dartbooks) and explicitly did NOT want a month-rollover job silently
  // wiping leads. Set LEAD_RETENTION_DAYS > 0 only for a dealer who opts into
  // auto-purge; otherwise nothing is auto-deleted.
  const retentionDays = Number(process.env.LEAD_RETENTION_DAYS ?? 0);
  let purged = 0;
  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    for (const table of ["site_leads", "site_finance_applications"] as const) {
      const { error: delErr, count } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .lt("created_at", cutoff);
      if (delErr) throw new Error(`${table} purge failed: ${delErr.message}`);
      purged += count ?? 0;
    }
  }

  return { fetched: vehicles.length, upserted: rows.length, archived, purged };
}
