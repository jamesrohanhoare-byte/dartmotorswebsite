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
  "body_style",
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
 * VMG's condition is free text ("Good", "Excellent", "Needs Attention").
 * Meta's vehicle `condition` is a quality rating: EXCELLENT / GOOD / FAIR / POOR.
 * The two happen to line up almost exactly, which is lucky, not designed.
 */
function metaCondition(condition: string | null): string {
  const c = (condition ?? "").toLowerCase();
  if (/excellent/.test(c)) return "EXCELLENT";
  if (/good/.test(c)) return "GOOD";
  if (/fair|needs attention/.test(c)) return "FAIR";
  if (/poor|bad/.test(c)) return "POOR";
  return "GOOD"; // VMG's most common value; never leave a required field blank
}

/**
 * body_style — REQUIRED by Meta, and VMG does not publish it.
 *
 * Learned the hard way: the first upload rejected all 48 cars with
 * "body_style is required". So it has to be derived.
 *
 * Two-stage on purpose:
 *  1. STRUCTURAL signals in the variant string. These are SA trade notation and
 *     are reliable: "P/U" is a bakkie, "P/V" a panel van, "KOMBI"/"CARAVELLE"/
 *     "MICROBUS" a people carrier. Checked FIRST because they beat model names
 *     ("CORSA UTILITY ... P/U" is a bakkie, a plain "CORSA" is a hatch).
 *  2. An EXPLICIT MODEL TABLE for everything else. Body type for a car cannot be
 *     inferred from its name by pattern — you either know that a Fortuner is an
 *     SUV and a Polo is a hatch, or you do not. A clever regex here would just be
 *     confidently wrong, so this is a maintained list instead.
 *
 * Anything unmatched returns OTHER rather than a guess. OTHER is a valid value
 * and a wrong body style is worse than a vague one: it puts the car in front of
 * the wrong buyer.
 *
 * ⚠️ Values restricted to ones confirmed in Meta's own vehicle categories
 * (Convertible, Coupe, Hatchback, Minivan, Sedan, SUV, Truck, Other). Do NOT add
 * values like VAN, WAGON or CROSSOVER without confirming them against a real
 * upload — an unaccepted value rejects the whole row.
 */
const BODY_STRUCTURAL: [RegExp, string][] = [
  [/\bP\/?U\b|\bPU\b|\bBAKKIE\b/i, "TRUCK"], // pickup / bakkie
  [/\bKOMBI\b|\bCARAVELLE\b|\bMICROBUS\b|\bC\/BUS\b/i, "MINIVAN"], // people carrier
  [/\bP\/V\b|\bPANEL\s*VAN\b/i, "OTHER"], // panel van: no confirmed VAN value
  [/\bCABRIOLET\b|\bCONVERTIBLE\b|\bROADSTER\b|\bCABRIO\b/i, "CONVERTIBLE"],
  [/\bCOUPE\b|\bCOUPÉ\b/i, "COUPE"],
];

const BODY_BY_MODEL: [RegExp, string][] = [
  // SUVs
  [/\bECOSPORT\b|\bKUGA\b|\bSPORTAGE\b|\bPAJERO\b|\bJUKE\b|\bQASHQAI\b/i, "SUV"],
  [/\bX[\s-]?TRAIL\b|\bFORTUNER\b|\bPRADO\b|\bRAV\s?4\b|\bTIGUAN\b/i, "SUV"],
  [/\bTUCSON\b|\bCRETA\b|\bDUSTER\b|\bCAPTUR\b|\bEVOQUE\b|\bDISCOVERY\b/i, "SUV"],
  [/\bX[1-7]\b|\bQ[2-8]\b|\bGLA\b|\bGLC\b|\bGLE\b|\bTOUAREG\b|\bCR-?V\b/i, "SUV"],
  // Hatchbacks
  [/\bJAZZ\b|\bATOS\b|\bi10\b|\bi20\b|\bALTO\b|\bCELERIO\b|\bSWIFT\b/i, "HATCHBACK"],
  [/\bGOLF\b|\bPOLO\b|\bUP!?\b|\b207\b|\b208\b|\bCOOPER\b|\bRIO\b/i, "HATCHBACK"],
  [/\bFIESTA\b|\bMICRA\b|\bYARIS\b|\bCORSA\b|\bETIOS\b|\b118i\b|\b120i\b/i, "HATCHBACK"],
  // Sedans
  [/\bC1[0-9]{2}\b|\bC2[0-9]{2}\b|\bSENTRA\b|\bJETTA\b|\bCOROLLA\b/i, "SEDAN"],
  [/\bCRUZE\b|\bACCENT\b|\bELANTRA\b|\bALMERA\b|\bE[0-9]{3}\b|\bA[3-6]\b/i, "SEDAN"],
];

function metaBodyStyle(v: SiteStock): string {
  const text = `${v.variant ?? ""} ${v.title ?? ""}`;
  // VMG is inconsistent about spacing: "RIO1.4 (4DR)" and "KB300D-TEQ" run the
  // model straight into the engine size, so \bRIO\b never matches. Testing a
  // letter/digit-split copy as well catches those without breaking model names
  // that ARE letter+digit, like C220 or X5 (which still match the raw text).
  const spaced = text.replace(/([A-Za-z])(\d)/g, "$1 $2");
  const hit = (re: RegExp) => re.test(text) || re.test(spaced);
  for (const [re, body] of BODY_STRUCTURAL) if (hit(re)) return body;
  for (const [re, body] of BODY_BY_MODEL) if (hit(re)) return body;
  return "OTHER";
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
    body_style: metaBodyStyle(v),
    condition: metaCondition(v.condition),
    transmission: metaTransmission(v),
    // Optional until migration 00051 lands and the sync starts capturing it.
    // Reads as "" rather than "undefined" in the meantime, so the feed is valid
    // either way and simply gets richer once the column exists.
    vin: v.vin ?? "",
    // Uppercase: Meta's vehicle availability enum is AVAILABLE / NOT_AVAILABLE.
    availability: v.status === "sold" ? "NOT_AVAILABLE" : "AVAILABLE",
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
