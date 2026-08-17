import { getStockForMetaFeed } from "@/lib/queries-feed";
import { META_COLUMNS, isFeedEligible, toFeedRow } from "@/lib/meta/feedRow";
import { toCsv } from "@/lib/meta/csv";

/**
 * Meta vehicle catalog feed. Commerce Manager fetches this on a schedule
 * (hourly) and reconciles catalog 1685644072506010 against it, so this route is
 * the single thing standing between Dart's live floor and what their ads show.
 *
 * Route handlers are uncached in Next 16 by default, which is what we want here:
 * Meta must never be handed a stale body listing a car that has already sold. At
 * one fetch an hour the Supabase read is free, so there is nothing to optimise.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Optional shared-key guard. Only enforced when the env var is set, so a
  // missing variable can never take the feed offline and silently empty the
  // catalog — which would pull every catalog ad down with it.
  const requiredKey = process.env.META_FEED_KEY;
  if (requiredKey) {
    const key = new URL(request.url).searchParams.get("key");
    if (key !== requiredKey) {
      return new Response("forbidden", { status: 403 });
    }
  }

  const stock = await getStockForMetaFeed();
  const rows = stock.filter(isFeedEligible).map(toFeedRow);
  const csv = toCsv(META_COLUMNS, rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Meta re-fetches hourly; a short shared cache absorbs any retry storm
      // without ever serving a stale day.
      "Cache-Control": "public, max-age=0, s-maxage=600",
      "Content-Disposition": 'inline; filename="dart-motors-vehicles.csv"',
    },
  });
}
