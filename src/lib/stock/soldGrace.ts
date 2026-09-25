import type { SiteStock } from "@/lib/types";

/**
 * The single owner of "this car is sold, but it is still ours to serve".
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * 2026-09-25: the Meta catalog was advertising 28 sold cars whose landing pages
 * returned 404. Two files had each made a reasonable decision on their own and
 * the pair of them was wrong:
 *
 *   - meta/feedRow.ts kept a sold car in the feed for 90 days on purpose, so a
 *     ViewContent fired before the sale still resolves to a catalog item.
 *   - queries.ts filtered every read to status='available' on purpose, so a sold
 *     car can never turn up in a listing.
 *
 * Both rules are right. Together they meant Meta held live catalog items whose
 * `url` 404'd, which burns paid clicks and is exactly the kind of item Commerce
 * Manager disapproves. The rule now lives in ONE function that both sides call,
 * so the feed and the website cannot drift apart again.
 *
 * The invariant is NOT "a sold car never appears on the website". It is:
 *   a sold car never appears in a LISTING (shop grid, featured row, related row,
 *   sitemap), but its own page still renders, clearly marked sold, for as long as
 *   the feed is still pointing advertising at it.
 */

/** How long a sold car stays in the feed, and stays servable on the website. */
export const SOLD_GRACE_DAYS = 90;

/**
 * synced_at freezes at the last sync that still saw the car in the VMG feed,
 * which is exactly "when it left the floor". A row with no synced_at is treated
 * as long gone rather than forever fresh.
 */
export function isWithinSoldGrace(
  v: Pick<SiteStock, "synced_at">,
  now: number = Date.now(),
): boolean {
  const lastSeen = v.synced_at ? new Date(v.synced_at).getTime() : 0;
  if (!Number.isFinite(lastSeen) || lastSeen === 0) return false;
  return now - lastSeen <= SOLD_GRACE_DAYS * 86_400_000;
}
