import type { SiteStock } from "@/lib/types";

/**
 * THE single source of the Meta catalog vehicle ID.
 *
 * ⚠️ Imported by BOTH the catalog feed (src/lib/meta/feedRow.ts) and the pixel
 * (src/components/site/VehicleViewTracker.tsx). Meta joins a pixel event to a
 * catalog item by exact string equality on this value, so if the two ever
 * diverge, retargeting silently stops working and NOTHING errors — no warning,
 * no failed build, just ads that quietly never find their audience.
 *
 * One function, imported twice, is the entire defence. Do not inline it.
 *
 * Uses stock_id (the VMG stock number) rather than the slug: it is the stable
 * dealer-side identifier and survives any future change to the slug format.
 */
export function metaVehicleId(v: Pick<SiteStock, "stock_id">): string {
  return String(v.stock_id);
}
