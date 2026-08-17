// One-off diagnostic: dump every XML node name VMG actually publishes per vehicle,
// so we know which Meta catalog fields we can fill. The website's parser
// (src/lib/feed/fetchFeed.ts) only reads the nodes the site needed, so this is the
// only way to see what else is on offer.
//
// Run: node --env-file=.env.local scripts/inspect-vmg-fields.mjs
import { XMLParser } from "fast-xml-parser";

const url = process.env.VMG_FEED_URL;
if (!url) {
  console.error("VMG_FEED_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const xml = await (await fetch(url)).text();
const parser = new XMLParser({
  isArray: (t) => t === "vehicle" || t === "imgurl",
  ignoreAttributes: true,
  parseTagValue: true,
});
const vehicles = parser.parse(xml)?.stock?.dealer?.vehicle ?? [];
console.log(`vehicles in feed: ${vehicles.length}\n`);

// Union of every key seen across all vehicles (some cars omit optional nodes).
const keys = new Set();
for (const v of vehicles) for (const k of Object.keys(v)) keys.add(k);
console.log("ALL NODE NAMES:\n  " + [...keys].sort().join("\n  "));

console.log("\nFIRST VEHICLE, VERBATIM:");
console.log(JSON.stringify(vehicles[0], null, 2).slice(0, 2500));

// The specific fields Meta's vehicle catalog wants that we do not currently parse.
const WANTED = ["vin", "VIN", "Vin", "fuel", "fuelType", "FuelType", "fueltype",
  "body", "bodyType", "BodyType", "bodytype", "transmission", "Transmission",
  "drivetrain", "Drivetrain", "model", "Model", "trim", "Trim", "engine",
  "Engine", "doors", "Doors", "seats"];
console.log("\nMETA-RELEVANT NODES PRESENT:");
const found = WANTED.filter((w) => keys.has(w));
for (const w of found) console.log(`  ✅ ${w} = ${JSON.stringify(vehicles[0][w])}`);
if (!found.length) console.log("  (none)");
console.log("\nMISSING:", WANTED.filter((w) => !keys.has(w)).join(", "));

// How many cars would be EXCLUDED from the catalog under the plan's rules.
let noPrice = 0, noImages = 0;
for (const v of vehicles) {
  const p = parseFloat(String(v.price)) || 0;
  if (!(p > 0)) noPrice++;
  const imgs = v.images?.imgurl ?? [];
  if (!imgs.length) noImages++;
}
console.log(`\nFEED ELIGIBILITY (of ${vehicles.length} cars):`);
console.log(`  no price (POA), excluded: ${noPrice}`);
console.log(`  no images, excluded:      ${noImages}`);
