import { XMLParser } from "fast-xml-parser";
import type { FeedVehicle } from "./types";

// Ported from the VMGFeedDartMotors project (lib/fetchFeed.ts). The `isArray`
// guard is critical: a dealer with a single car or a single photo would
// otherwise parse those nodes as objects, not arrays.
//
// ⚠️ The f1 format (`/xml/f1/feed_{dealer}.xml`) is the one we want, not f15.
// Both list the same cars, but f15 stops at 10 photos per car while f1 carries
// up to 20 (VMG's own cap, and Meta's). Found 2026-10-23: Dart's dog photos were
// on the portals but never on the site because they sat past photo 10. The two
// formats spell a few tags differently (Colour/colour, Description/description),
// so the parser reads both.
//
// VMG enables f1 per dealer (Dart's is on, Riverside's 404'd on 2026-10-23), so
// a dealer configured on f15 tries f1 first and falls back to f15 rather than
// stop syncing. Stock and prices stay current either way, the day VMG enables
// f1 the photos upgrade with no config change, and `photoFeed` in the sync
// response says which one ran so a 10-photo cap is never silent.
export interface FeedFetch {
  vehicles: FeedVehicle[];
  photoFeed: string;
}

const CAPPED = "f15: capped at 10 photos per car. Ask VMG to enable the f1 feed for this dealer";

/** The f1 twin of an f15 feed address. Any other address is returned unchanged. */
export function fullPhotoFeedUrl(url: string): string {
  return url.replace("/xml/f15/", "/xml/f1/");
}

async function readFeed(url: string): Promise<FeedVehicle[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch VMG feed: HTTP ${response.status}`);
  }
  return parseVehicles(await response.text());
}

export async function fetchVehicles(): Promise<FeedFetch> {
  const feedUrl = process.env.VMG_FEED_URL;
  if (!feedUrl) throw new Error("VMG_FEED_URL environment variable is not set");

  const fullUrl = fullPhotoFeedUrl(feedUrl);
  if (fullUrl !== feedUrl) {
    const vehicles = await readFeed(fullUrl).catch(() => []);
    if (vehicles.length > 0) return { vehicles, photoFeed: "f1" };
  }

  return { vehicles: await readFeed(feedUrl), photoFeed: feedUrl.includes("/xml/f15/") ? CAPPED : "f1" };
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
