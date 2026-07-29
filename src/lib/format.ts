import type { SiteStock } from "@/lib/types";

export function formatPrice(price: number | null): string {
  if (price == null || price === 0) return "POA";
  return "R " + new Intl.NumberFormat("en-ZA").format(price);
}

export function formatMileage(km: number | null): string {
  if (km == null) return "n/a";
  return new Intl.NumberFormat("en-ZA").format(km) + " km";
}

/** Display title for a stock item — feed-provided title, else assembled. */
export function stockTitle(v: Pick<SiteStock, "year" | "make" | "variant" | "title">): string {
  if (v.title) return v.title;
  return [v.year, v.make, v.variant].filter(Boolean).join(" ");
}

/** How long a car counts as newly listed. */
export const JUST_IN_DAYS = 30;

/**
 * Newly listed = first seen by the feed sync within the window. `created_at`
 * is the first-sync timestamp (the upsert never rewrites it); the July 2026
 * launch batch was backfilled to 2026-06-01 so pre-site stock never qualifies.
 */
export function isJustIn(v: Pick<SiteStock, "created_at">): boolean {
  if (!v.created_at) return false;
  return Date.now() - new Date(v.created_at).getTime() < JUST_IN_DAYS * 86_400_000;
}

/** Split the VMG `extras` blob into a clean feature list. */
export function stockFeatures(extras: string | null): string[] {
  if (!extras) return [];
  return extras
    .split(/[,|\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Best-effort transmission read from the variant text (e.g. "118i A/T"). */
export function transmissionFromVariant(variant: string | null): string | null {
  if (!variant) return null;
  if (/\bA\/?T\b|\bauto/i.test(variant)) return "Automatic";
  if (/\bM\/?T\b|\bmanual/i.test(variant)) return "Manual";
  return null;
}
