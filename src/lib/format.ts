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
