import type { SiteStock } from "@/lib/types";
import { dealer } from "@/config/dealer";
import { stockTitle, transmissionFromVariant } from "@/lib/format";
import { metaVehicleId } from "./vehicleId";

/**
 * Maps one site_stock row to one Meta vehicle-catalog row.
 *
 * Column names follow Meta's automotive inventory feed spec. ⚠️ Meta's own
 * validator is the final authority on required columns and enum spellings —
 * when the first real upload runs, reconcile against its error report and
 * record the outcome here so the next dealer starts from proven ground.
 */

/** How long a sold car stays in the feed so historical events still resolve. */
const SOLD_GRACE_DAYS = 90;

/** VMG publishes up to 10 images per car; carry all of them. */
const IMAGE_SLOTS = 10;

/** Fixed column order. The feed's header row is exactly this, in this order. */
export const META_COLUMNS: string[] = [
  "vehicle_id",
  "title",
  "description",
  "url",
  "make",
  "model",
  "year",
  "mileage.value",
  "mileage.unit",
  "price",
  "exterior_color",
  "state_of_vehicle",
  "condition",
  "transmission",
  "vin",
  "availability",
  "address",
  "latitude",
  "longitude",
  "dealer_name",
  ...Array.from({ length: IMAGE_SLOTS }, (_, i) => `image[${i}].url`),
];

/**
 * Whether a row belongs in the catalog at all.
 *
 * Four exclusions, each with a real reason:
 *  - manual listings: a trailer has no make/model/year/mileage and fails
 *    validation (same reasoning as the Product-vs-Car split in shop/[slug])
 *  - POA: a catalog entry cannot exist without a price
 *  - no images: image[0].url is required
 *  - long-sold: kept 90 days so a past ViewContent can still be attributed,
 *    then dropped so the catalog does not grow forever
 */
export function isFeedEligible(v: SiteStock): boolean {
  if (v.source === "manual") return false;
  if (!v.price || v.price <= 0) return false;
  if (!v.images?.length) return false;
  if (v.status === "sold") {
    // synced_at freezes at the last sync that still saw the car in the VMG
    // feed, which is exactly "when it left the floor".
    const lastSeen = v.synced_at ? new Date(v.synced_at).getTime() : 0;
    if (Date.now() - lastSeen > SOLD_GRACE_DAYS * 86_400_000) return false;
  }
  return true;
}

/**
 * extras carries an explicit "Automatic" entry in its comma-separated list,
 * which is a far more reliable signal than regexing "A/T" out of the variant
 * string. The variant read stays as the fallback.
 */
function metaTransmission(v: SiteStock): string {
  const extras = v.extras ?? "";
  if (/(^|,)\s*automatic\s*(,|$)/i.test(extras)) return "AUTOMATIC";
  if (/(^|,)\s*manual\s*(,|$)/i.test(extras)) return "MANUAL";
  const t = transmissionFromVariant(v.variant);
  return t ? t.toUpperCase() : "";
}

/** VMG's newUsed is free text ("Used", "used", "New"); Meta wants NEW/USED. */
function metaStateOfVehicle(newUsed: string | null): string {
  return /new/i.test(newUsed ?? "") ? "NEW" : "USED";
}

/**
 * VMG sends "VOLKSWAGEN". An ad headline reading "2013 VOLKSWAGEN AMAROK"
 * shouts; "Volkswagen" does not. Feed only — the website rendering is untouched.
 *
 * ⚠️ Deliberately NOT applied to `variant`, which contains BiTDi, 4MOT, A/T,
 * D/C and P/U. Any casing pass would mangle all of them.
 */
function titleCaseMake(make: string): string {
  return make.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Collapse all whitespace to single spaces.
 *
 * VMG descriptions are multi-line ("A stunning double cab bakkie!!\nGreat
 * Economy...\n"). RFC4180 permits newlines inside a quoted field and our writer
 * quotes them correctly, but plenty of third-party CSV parsers mishandle them,
 * and a feed that fails to parse takes every catalog ad down with it. Meta
 * renders the description as a single line anyway, so nothing is lost by
 * flattening it here and the whole class of risk disappears.
 */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function toFeedRow(v: SiteStock): Record<string, string> {
  // Assembled rather than taking v.title verbatim, because v.title is built by
  // the sync as "{year} {MAKE} {variant}" and would keep the shouted make. The
  // title IS the ad headline, so it has to agree with the `make` column.
  // stockTitle stays the fallback for a row with no year.
  const title = v.year
    ? [v.year, titleCaseMake(v.make), v.variant].filter(Boolean).join(" ")
    : stockTitle(v);

  // Meta requires a non-empty description, and VMG leaves it blank often enough
  // that an unconditional fallback is the only safe option — otherwise those
  // cars are silently rejected at upload with no obvious cause.
  const description =
    v.description?.trim() ||
    [title, v.mileage ? `${v.mileage} km` : null, v.colour, `Available at ${dealer.name}`]
      .filter(Boolean)
      .join(", ");

  const row: Record<string, string> = {
    vehicle_id: metaVehicleId(v),
    title: flatten(title),
    description: flatten(description),
    url: `${dealer.siteUrl}/shop/${v.slug}`,
    make: titleCaseMake(v.make),
    // VMG gives no separate model node — only a combined variant string
    // ("AMAROK 2.0 BiTDi HIGHLINE 132KW 4MOT A/T D/C P/U"). Falling back to make
    // keeps the required field populated for a car with no variant.
    model: v.variant || v.make,
    year: v.year ? String(v.year) : "",
    "mileage.value": v.mileage != null ? String(v.mileage) : "0",
    "mileage.unit": "KM",
    price: `${v.price} ZAR`,
    exterior_color: v.colour ?? "",
    state_of_vehicle: metaStateOfVehicle(v.new_used),
    condition: v.condition ?? "",
    transmission: metaTransmission(v),
    // Optional until migration 00051 lands and the sync starts capturing it.
    // Reads as "" rather than "undefined" in the meantime, so the feed is valid
    // either way and simply gets richer once the column exists.
    vin: v.vin ?? "",
    availability: v.status === "sold" ? "not_available" : "available",
    address: JSON.stringify({
      addr1: dealer.address.line1,
      city: dealer.address.city,
      region: dealer.address.province,
      postal_code: dealer.address.postalCode,
      country: dealer.address.country,
    }),
    latitude: String(dealer.geo.lat),
    longitude: String(dealer.geo.lng),
    dealer_name: dealer.name,
  };

  for (let i = 0; i < IMAGE_SLOTS; i++) {
    row[`image[${i}].url`] = v.images[i] ?? "";
  }

  return row;
}
