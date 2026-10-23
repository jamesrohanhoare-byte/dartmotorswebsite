import { XMLParser } from "fast-xml-parser";
import type { FeedVehicle } from "./types";

// Ported from the VMGFeedDartMotors project (lib/fetchFeed.ts). The `isArray`
// guard is critical: a dealer with a single car or a single photo would
// otherwise parse those nodes as objects, not arrays.
//
// ⚠️ VMG_FEED_URL must be the **f1** format (`/xml/f1/feed_{dealer}.xml`), not f15.
// Both list the same cars, but f15 stops at 10 photos per car while f1 carries
// up to 20 (VMG's own cap, and Meta's). Found 2026-10-23: Dart's dog photos were
// on the portals but never on the site because they sat past photo 10. The two
// formats spell a few tags differently (Colour/colour, Description/description),
// so the parser reads both and either URL works.
export async function fetchVehicles(): Promise<FeedVehicle[]> {
  const feedUrl = process.env.VMG_FEED_URL;
  if (!feedUrl) throw new Error("VMG_FEED_URL environment variable is not set");

  const response = await fetch(feedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch VMG feed: HTTP ${response.status}`);
  }

  return parseVehicles(await response.text());
}

/**
 * Tags a photo link with the car's last-edited time in VMG.
 *
 * VMG names photos by position (`1032_1102_I1.jpg`), so replacing photo 1 in VMG
 * overwrites the same file at the same link. Everything that caches by link
 * (the weserv image CDN for a year, visitors' browsers, Meta's catalog) then
 * keeps showing the old picture. Proven on stock 1102 on 2026-10-23: the listing
 * card served the cover from before the dog was added. VMG bumps DateUpdated
 * when photos change, so tagging the link with it gives every edit a fresh link.
 * S3 ignores the query string.
 */
export function versionImageUrl(url: string, dateUpdated: string): string {
  const version = dateUpdated.replace(/\D/g, "");
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

export function parseVehicles(xml: string): FeedVehicle[] {
  const parser = new XMLParser({
    isArray: (tagName) => tagName === "vehicle" || tagName === "imgurl",
    ignoreAttributes: true,
    parseTagValue: true,
  });

  const parsed = parser.parse(xml);
  const rawVehicles: unknown[] = parsed?.stock?.dealer?.vehicle ?? [];

  return (rawVehicles as Record<string, unknown>[]).map((v): FeedVehicle => {
    const dateUpdated = String(v.DateUpdated ?? "");
    const imagesNode = (v.images as { imgurl?: unknown[] } | undefined)?.imgurl ?? [];
    const images = (imagesNode as unknown[])
      .map((img) => String(img))
      .filter(Boolean)
      .map((url) => versionImageUrl(url, dateUpdated));

    // Price regex guards the "R299 900 2013 Mahindra"-style glue bug (year
    // getting appended to price) seen in the market scraper: take the price as
    // parsed, but clamp to a sane ceiling.
    const price = parseFloat(String(v.price)) || 0;

    return {
      stockID: Number(v.stockID) || 0,
      dateUpdated,
      newUsed: String(v.newUsed ?? ""),
      make: String(v.Make ?? ""),
      variant: String(v.variant ?? ""),
      price: price > 0 && price < 50_000_000 ? price : 0,
      mileage: Number(v.mileage) || 0,
      year: Number(v.year) || 0,
      colour: String(v.Colour ?? v.colour ?? ""),
      extras: String(v.extras ?? ""),
      condition: String(v.condition ?? ""),
      description: String(v.Description ?? v.description ?? ""),
      referenceID: Number(v.referenceID) || 0,
      // VMG publishes <VIN> and <mmCode> per vehicle (confirmed against the live
      // feed 2026-08-17). It also publishes the registration (<licenceNumber> in
      // f15, <Registration> in f1), which is personal data and is deliberately
      // never read — see feed/types.ts.
      vin: String(v.VIN ?? ""),
      mmCode: Number(v.mmCode) || 0,
      images,
    };
  });
}
