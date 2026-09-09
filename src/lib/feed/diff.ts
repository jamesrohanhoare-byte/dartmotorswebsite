import type { SiteStock } from "../types";

/**
 * The columns the VMG feed owns on a site_stock row. Compared field-for-field to
 * decide whether a sync actually changed the floor.
 *
 * Why this exists: every sync used to call revalidatePath("/", "layout") no matter
 * what, so five times a day every page on the site re-rendered for nothing. On
 * Next 16 one page regeneration writes ~11 cache entries (HTML + RSC + segment
 * prefetch files), and that was ~20% of the ISR-write budget that pushed Dart's
 * Vercel team to the 75% warning on 2026-09-08. A sync that found no difference
 * must now leave the cache alone.
 *
 * synced_at, id, created_at and source are bookkeeping: they never mean the car
 * changed, so they are deliberately not in this list.
 */
export const FEED_FIELDS = [
  "stock_id",
  "make",
  "variant",
  "title",
  "year",
  "price",
  "mileage",
  "colour",
  "new_used",
  "condition",
  "extras",
  "description",
  "reference_id",
  "vin",
  "mm_code",
  "date_updated",
  "images",
  "status",
  "featured",
] as const;

type FeedField = (typeof FEED_FIELDS)[number];

/** A site_stock row reduced to what the feed controls. Extra columns are ignored. */
export type FeedRow = { slug: string } & { [K in FeedField]?: SiteStock[K] | null };

export interface StockDiff {
  /** In the feed, not yet on the site. */
  added: string[];
  /** On the site, but at least one feed-owned field differs. */
  changed: string[];
  /** On the site, no longer in the feed (the sync will mark these sold). */
  removed: string[];
  total: number;
}

// null and undefined both mean "absent"; a column that was never set must not
// read as a change against one that was set to null.
//
// date_updated is compared as an instant, not a string: PostgREST hands back
// timestamptz as "2026-09-07T12:36:08+00:00" while the sync writes it as
// "2026-09-07T12:36:08.000Z". Same moment, different spelling — and on the first
// live run that spelling alone flagged all 31 cars as changed.
function normalise(field: FeedField, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (field === "date_updated" && typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? value : ms;
  }
  return value;
}

function fingerprint(row: FeedRow): string {
  return JSON.stringify(FEED_FIELDS.map((field) => normalise(field, row[field])));
}

export function diffStock(existing: readonly FeedRow[], incoming: readonly FeedRow[]): StockDiff {
  const before = new Map(existing.map((row) => [row.slug, fingerprint(row)]));
  const added: string[] = [];
  const changed: string[] = [];
  const seen = new Set<string>();

  for (const row of incoming) {
    seen.add(row.slug);
    const previous = before.get(row.slug);
    if (previous === undefined) added.push(row.slug);
    else if (previous !== fingerprint(row)) changed.push(row.slug);
  }

  const removed = [...before.keys()].filter((slug) => !seen.has(slug));

  return { added, changed, removed, total: added.length + changed.length + removed.length };
}
