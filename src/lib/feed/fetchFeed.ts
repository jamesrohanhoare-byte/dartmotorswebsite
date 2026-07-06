import { XMLParser } from "fast-xml-parser";
import type { FeedVehicle } from "./types";

// Ported from the VMGFeedDartMotors project (lib/fetchFeed.ts). The `isArray`
// guard is critical: a dealer with a single car or a single photo would
// otherwise parse those nodes as objects, not arrays.
export async function fetchVehicles(): Promise<FeedVehicle[]> {
  const feedUrl = process.env.VMG_FEED_URL;
  if (!feedUrl) throw new Error("VMG_FEED_URL environment variable is not set");

  const response = await fetch(feedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch VMG feed: HTTP ${response.status}`);
  }

  const xml = await response.text();

  const parser = new XMLParser({
    isArray: (tagName) => tagName === "vehicle" || tagName === "imgurl",
    ignoreAttributes: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xml);
  const rawVehicles: unknown[] = parsed?.stock?.dealer?.vehicle ?? [];

  return (rawVehicles as Record<string, unknown>[]).map((v): FeedVehicle => {
    const imagesNode = (v.images as { imgurl?: unknown[] } | undefined)?.imgurl ?? [];
    const images = (imagesNode as unknown[]).map((img) => String(img)).filter(Boolean);

    // Price regex guards the "R299 900 2013 Mahindra"-style glue bug (year
    // getting appended to price) seen in the market scraper: take the price as
    // parsed, but clamp to a sane ceiling.
    const price = parseFloat(String(v.price)) || 0;

    return {
      stockID: Number(v.stockID) || 0,
      dateUpdated: String(v.DateUpdated ?? ""),
      newUsed: String(v.newUsed ?? ""),
      make: String(v.Make ?? ""),
      variant: String(v.variant ?? ""),
      price: price > 0 && price < 50_000_000 ? price : 0,
      mileage: Number(v.mileage) || 0,
      year: Number(v.year) || 0,
      colour: String(v.Colour ?? ""),
      extras: String(v.extras ?? ""),
      condition: String(v.condition ?? ""),
      description: String(v.Description ?? ""),
      referenceID: Number(v.referenceID) || 0,
      images,
    };
  });
}
