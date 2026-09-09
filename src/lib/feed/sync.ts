import { fetchVehicles } from "./fetchFeed";
import { createServiceClient } from "@/lib/supabase/service";
import { diffStock, FEED_FIELDS, type FeedRow } from "./diff";

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
  /** Cars added, edited or marked sold by this run. Zero means the site's cached
   *  pages are still correct and the caller must NOT revalidate them. */
  changed: number;
  /** The slugs behind `changed`, so a run's response says which cars moved. */
  changes: string[];
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
      vin: v.vin || null,
      mm_code: v.mmCode || null,
      date_updated: toISO(v.dateUpdated),
      images: v.images,
      status: "available" as const,
      // Explicit rather than relying on the column default: if a slug ever collides
      // with a hand-made row, the feed reclaims ownership of it, which is correct.
      source: "feed" as const,
      // Featured is driven by VMG: any car set to "Excellent" condition in VMG
      // is automatically featured on the site. Dealer controls it from VMG Smart.
      featured: /excellent/i.test(v.condition || ""),
      synced_at: now,
    };
  });

  // What the site holds right now, read before we touch it. Two jobs: the diff
  // that decides whether any cached page needs regenerating, and the stale list.
  //
  // Scoped to source='feed' — the sync only reconciles what the feed owns. Manual
  // listings (a trailer, a bakkie canopy, anything created in Dartbooks) are not in
  // the VMG feed by definition, so without this filter every sync would flip them to
  // 'sold' and the page would die silently within hours. See migration 00050.
  const { data: existingRows, error: readErr } = await supabase
    .from("site_stock")
    .select(["slug", ...FEED_FIELDS].join(","))
    .eq("source", "feed");
  if (readErr) throw new Error(`site_stock read failed: ${readErr.message}`);
  const existing = (existingRows ?? []) as unknown as FeedRow[];

  const diff = diffStock(existing, rows);

  // Upsert (featured now reflects VMG condition on every sync).
  const { error: upErr } = await supabase.from("site_stock").upsert(rows, {
    onConflict: "slug",
  });
  if (upErr) throw new Error(`site_stock upsert failed: ${upErr.message}`);

  // Soft-delete stale: available rows whose slug is no longer in the feed.
  // (A row already marked sold and still absent from the feed is not a change.)
  const feedSlugs = new Set(rows.map((r) => r.slug));
  const staleSlugs = existing
    .filter((r) => r.status === "available" && !feedSlugs.has(r.slug))
    .map((r) => r.slug);

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

  const changes = [...diff.added, ...diff.changed, ...staleSlugs];
  return {
    fetched: vehicles.length,
    upserted: rows.length,
    archived,
    purged,
    changed: changes.length,
    changes,
  };
}
