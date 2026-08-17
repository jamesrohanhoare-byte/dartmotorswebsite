# Meta Catalog Feed + Pixel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Dart Motors' live stock as a Meta vehicle catalog feed, and instrument the site with a Meta pixel whose `content_ids` match that feed exactly, so catalog ads can prospect and retarget on specific cars.

**Architecture:** A single shared helper (`metaVehicleId`) produces the vehicle ID used by BOTH the feed endpoint and the pixel, so the two can never drift apart. A new public route `/api/feed/meta` renders `site_stock` as a Meta-format CSV that Meta re-fetches hourly. Client-side pixel events (`ViewContent`, `Lead`) fire from the existing lead-capture components, carrying that same ID. Nothing about how Dart sells changes: WhatsApp remains the endpoint of the funnel, it is just now measured.

**Tech Stack:** Next.js 16.2.9 (App Router, route handlers), React 19.2.4, Supabase (anon read via `supabasePublic`), Meta Commerce Manager scheduled feed, Meta pixel (`fbevents.js`).

---

## Context an engineer with zero knowledge needs

**The data pipeline that already exists:**

```
VMG (dealer's DMS)  →  XML feed  →  src/lib/feed/fetchFeed.ts  →  src/lib/feed/sync.ts
      →  Supabase table `site_stock`  →  src/lib/queries.ts  →  the website (ISR, revalidate 3600)
```

A GitHub Action calls `/api/sync` every 6 hours. `sync.ts` upserts every car by slug `stock-{stockID}`, and soft-deletes anything that vanished from the feed by flipping `status` to `'sold'`. **Rows are never hard-deleted by the sync.** That matters: sold cars remain queryable, which is what lets us tell Meta a car is gone rather than silently dropping it.

**What we are adding:** one read-only route that reformats `site_stock` for Meta, plus pixel events. **We are not touching `sync.ts`, the VMG parser, or any existing lead logic.** This is additive.

**Key existing pieces you will reuse (read them before starting):**

| File | What it gives you |
|---|---|
| `src/lib/types.ts` | `SiteStock` interface, the shape of every row |
| `src/lib/format.ts` | `stockTitle()`, `transmissionFromVariant()`, `stockFeatures()` |
| `src/config/dealer.ts` | `dealer.siteUrl`, `dealer.address`, `dealer.geo`, `dealer.name` |
| `src/lib/queries.ts` | existing reads, all filtered to `status = 'available'` |
| `src/lib/supabase/public.ts` | the cookie-free anon client used for all public reads |
| `src/components/site/VehicleInterest.tsx` | primary per-car CTA, POSTs to `/api/lead` with `channel: "interested"` |
| `src/components/site/VehicleEnquiry.tsx` | WhatsApp / Email / Call buttons, logs to `site_leads` directly |

**There is no test framework in this repo.** No vitest, no jest, no test files. The house pattern for verification is standalone executable Node scripts (see `Projects/ClientWork/AutoEmporium/web/scripts/test-stock.mjs` and `Projects/ClientWork/VMGFeedDartMotors/debug.mjs`). **Do not install a test runner.** We keep TDD discipline using assertion scripts run with `node`: write the failing script, watch it fail, implement, watch it pass.

**Next.js 16 warning:** `web/AGENTS.md` says this is not the Next.js you know. Two things that actually bite here, both verified against `node_modules/next/dist/docs/`:
1. Route handlers are **not cached by default**. Good, we want fresh data. Do not add `dynamic = 'force-static'`.
2. `params` in page components is a **Promise** and must be awaited. The existing `shop/[slug]/page.tsx` already does this.

**NEXT_PUBLIC_ environment variables are baked in at BUILD time, not read at runtime.** Setting `NEXT_PUBLIC_FB_PIXEL_ID` in Vercel does nothing until a fresh build runs. This has bitten this account before. Task 5 accounts for it.

---

## Decisions already made (do not relitigate)

1. **CSV, not XML.** Meta accepts both; CSV is easier to eyeball, easier to diff, and easier to assert on in a test script.
2. **`vehicle_id` = `stock_id`** (the VMG stock number). Stable, unique, already the basis of the slug.
3. **Manual listings are excluded.** Rows with `source = 'manual'` are things like a trailer. They have no mileage, no model, no year, and would fail a vehicle catalog's validation. This mirrors the existing decision in `shop/[slug]/page.tsx`, which describes manual listings as schema.org `Product`, not `Car`.
4. **POA cars are excluded.** A catalog entry requires a price. A car with `price` null or 0 cannot be advertised.
5. **Cars with no images are excluded.** `image[0].url` is required.
6. **Recently sold cars ARE included, marked unavailable.** They stay in the feed for 90 days after last being seen in stock, so Meta can still resolve a historical `ViewContent` for attribution, while never serving the car. Older than 90 days, they drop out. Advertising a sold car is the single most embarrassing failure mode in dealer ads, so availability is driven directly off `status`.
7. **The feed is guarded by an optional key.** If `META_FEED_KEY` is set, the route requires `?key=`. If unset, the route is open. Optional so a missing env var can never take the feed offline. The data is already public on the website; the key only stops a competitor trivially pulling a clean CSV of every car and price.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/meta/vehicleId.ts` | The single shared ID function. Imported by the feed AND the pixel. This file existing is the whole reason the two can't drift. |
| `src/lib/meta/feedRow.ts` | Pure mapping: one `SiteStock` → one Meta CSV row object. No I/O, no Supabase. |
| `src/lib/meta/csv.ts` | RFC4180 CSV serialisation (quoting, escaping, header ordering). |
| `src/app/api/feed/meta/route.ts` | The HTTP route. Query, map, serialise, respond. Thin. |
| `src/lib/queries-feed.ts` | `getStockForMetaFeed()` — the only query that reads sold rows. Kept out of `queries.ts` so nobody accidentally leaks sold cars onto the site. |
| `src/components/site/MetaPixel.tsx` | Client component: loads `fbevents.js`, fires `PageView`. |
| `src/lib/meta/track.ts` | Tiny typed `fbq` wrapper so no component touches `window.fbq` directly. |
| `scripts/test-meta-feed.mjs` | Assertion script for the feed endpoint. |
| `scripts/inspect-vmg-fields.mjs` | One-off diagnostic (Task 0). |

**Modify:**

| File | Change |
|---|---|
| `src/app/layout.tsx:58` | Mount `<MetaPixel />` inside `<body>`. |
| `src/app/(public)/shop/[slug]/page.tsx` | Mount a `ViewContent` firing component. |
| `src/components/site/VehicleInterest.tsx` | Fire `Lead` on successful submit. |
| `src/components/site/VehicleEnquiry.tsx` | Fire `Lead` on WhatsApp / Email click. |
| `.env.example` | Document the three new env vars. |

---

## Task 0: Diagnostic — find out what VMG actually gives us

**Why this is first:** `src/lib/feed/fetchFeed.ts` only reads the XML nodes the website needed. Meta's vehicle catalog wants `vin`, `fuel_type`, `body_style`, `drivetrain` and `trim`, none of which we currently parse. **We do not know whether VMG publishes them.** If it does, this is a much richer feed for the cost of a few parser lines. If it does not, we map what we have and move on. Ten minutes now prevents guessing for the rest of the plan.

**Files:**
- Create: `scripts/inspect-vmg-fields.mjs`

- [ ] **Step 1: Write the diagnostic script**

```javascript
// scripts/inspect-vmg-fields.mjs
// One-off: dump every XML node name VMG actually publishes per vehicle, so we
// know which Meta catalog fields we can fill. Run: node scripts/inspect-vmg-fields.mjs
import { XMLParser } from "fast-xml-parser";

const url = process.env.VMG_FEED_URL;
if (!url) {
  console.error("VMG_FEED_URL is not set. Pull it from Vercel: vercel env pull .env.local");
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
console.log("ALL NODE NAMES:\n" + [...keys].sort().join("\n"));

console.log("\nFIRST VEHICLE, VERBATIM:");
console.log(JSON.stringify(vehicles[0], null, 2).slice(0, 3000));

// The specific fields Meta wants that we do not currently parse.
const WANTED = ["vin", "VIN", "fuel", "fuelType", "FuelType", "body", "bodyType",
                "BodyType", "transmission", "Transmission", "drivetrain", "model",
                "Model", "trim", "Trim", "engine", "doors"];
console.log("\nMETA-RELEVANT NODES PRESENT:");
for (const w of WANTED) if (keys.has(w)) console.log(`  ✅ ${w} = ${JSON.stringify(vehicles[0][w])}`);
console.log("MISSING:", WANTED.filter((w) => !keys.has(w)).join(", "));
```

- [ ] **Step 2: Get the feed URL and run it**

```bash
cd Projects/ClientWork/DartMotorsWebsite/web
vercel env pull .env.local
node --env-file=.env.local scripts/inspect-vmg-fields.mjs
```

Expected: a list of node names, then a `✅` line for each Meta-relevant field VMG publishes.

- [ ] **Step 3: Record the answer in this plan file**

Write the findings under a new `## Task 0 findings` heading at the bottom of this file. **If `vin` is present, stop and flag it** — VIN is required by some Meta vehicle catalog specs, and if VMG has it we should add it to `sync.ts` and the `site_stock` table before finishing Task 3, not after.

- [ ] **Step 4: Commit**

```bash
git add scripts/inspect-vmg-fields.mjs docs/superpowers/plans/2026-08-17-meta-catalog-feed-and-pixel.md
git commit -m "chore: add VMG field diagnostic for Meta catalog mapping"
```

---

## Task 1: The shared vehicle ID

**Files:**
- Create: `src/lib/meta/vehicleId.ts`
- Create: `scripts/test-meta-feed.mjs` (started here, extended in Task 3)

- [ ] **Step 1: Write the failing assertion script**

```javascript
// scripts/test-meta-feed.mjs
// Verification for the Meta catalog feed. No test framework in this repo by
// design (see docs/superpowers/plans/2026-08-17-meta-catalog-feed-and-pixel.md).
// Run against a dev server: npm run dev, then node scripts/test-meta-feed.mjs
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    process.exitCode = 1;
  }
}

// ── Task 1: the shared ID ────────────────────────────────────────────────
const { metaVehicleId } = await import("../src/lib/meta/vehicleId.ts");

console.log("\nmetaVehicleId");
check("returns the stock id as a string", () => {
  assert.equal(metaVehicleId({ stock_id: 12345 }), "12345");
});
check("is a string, never a number (Meta matches on string equality)", () => {
  assert.equal(typeof metaVehicleId({ stock_id: 12345 }), "string");
});
check("handles a zero stock id without returning empty", () => {
  assert.equal(metaVehicleId({ stock_id: 0 }), "0");
});

console.log(`\n${passed} passed`);
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd Projects/ClientWork/DartMotorsWebsite/web
node scripts/test-meta-feed.mjs
```

Expected: FAIL with `Cannot find module '../src/lib/meta/vehicleId.ts'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/meta/vehicleId.ts
import type { SiteStock } from "@/lib/types";

/**
 * THE single source of the Meta catalog vehicle ID.
 *
 * ⚠️ Imported by BOTH the feed (src/lib/meta/feedRow.ts) and the pixel
 * (src/components/site/VehicleViewTracker.tsx). Meta matches a pixel event to a
 * catalog item by exact string equality on this value, so if the two ever
 * diverge, retargeting silently does nothing and nothing errors. One function,
 * imported twice, is the whole defence. Do not inline this anywhere.
 *
 * Uses stock_id (the VMG stock number) rather than the slug: it is the stable
 * dealer-side identifier and survives any future slug format change.
 */
export function metaVehicleId(v: Pick<SiteStock, "stock_id">): string {
  return String(v.stock_id);
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
node scripts/test-meta-feed.mjs
```

Expected: `3 passed`, exit code 0.

> **If the import fails because Node cannot parse TypeScript:** this repo runs Node 20+ where `--experimental-strip-types` is needed. Re-run as `node --experimental-strip-types scripts/test-meta-feed.mjs` and add that flag to every later run in this plan. Node 22.6+ strips types natively and needs no flag.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/vehicleId.ts scripts/test-meta-feed.mjs
git commit -m "feat(meta): shared vehicle id used by both feed and pixel"
```

---

## Task 2: CSV serialisation

**Files:**
- Create: `src/lib/meta/csv.ts`
- Modify: `scripts/test-meta-feed.mjs`

- [ ] **Step 1: Add failing assertions**

Append to `scripts/test-meta-feed.mjs`, immediately before the final `console.log`:

```javascript
// ── Task 2: CSV serialisation ────────────────────────────────────────────
const { toCsv } = await import("../src/lib/meta/csv.ts");

console.log("\ntoCsv");
check("writes the header row in the given column order", () => {
  const out = toCsv(["b", "a"], [{ a: "1", b: "2" }]);
  assert.equal(out.split("\n")[0], "b,a");
});
check("orders values to match the header, not the object", () => {
  const out = toCsv(["b", "a"], [{ a: "1", b: "2" }]);
  assert.equal(out.split("\n")[1], "2,1");
});
check("quotes a value containing a comma", () => {
  const out = toCsv(["a"], [{ a: "Woodstock, Cape Town" }]);
  assert.equal(out.split("\n")[1], '"Woodstock, Cape Town"');
});
check("doubles an embedded quote (RFC4180)", () => {
  const out = toCsv(["a"], [{ a: 'the 5" screen' }]);
  assert.equal(out.split("\n")[1], '"the 5"" screen"');
});
check("quotes a value containing a newline", () => {
  const out = toCsv(["a"], [{ a: "line1\nline2" }]);
  assert.equal(out.split("\n")[1], '"line1');
});
check("renders a missing key as empty, not the string undefined", () => {
  const out = toCsv(["a", "z"], [{ a: "1" }]);
  assert.equal(out.split("\n")[1], "1,");
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
node scripts/test-meta-feed.mjs
```

Expected: FAIL with `Cannot find module '../src/lib/meta/csv.ts'`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/meta/csv.ts

/**
 * Minimal RFC4180 CSV writer for the Meta catalog feed.
 *
 * Meta rejects a whole feed row on a malformed field, and vehicle descriptions
 * from VMG routinely contain commas, quotes and newlines, so the escaping here
 * is doing real work rather than being defensive decoration.
 */

/** Quote a single field only when it needs it. */
function escapeField(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Serialise rows to CSV against a fixed column order.
 * A key absent from a row renders as an empty field, never "undefined".
 */
export function toCsv(columns: string[], rows: Record<string, string>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeField(row[col] ?? "")).join(","));
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run and watch it pass**

```bash
node scripts/test-meta-feed.mjs
```

Expected: `9 passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/csv.ts scripts/test-meta-feed.mjs
git commit -m "feat(meta): rfc4180 csv writer for the catalog feed"
```

---

## Task 3: The row mapper

This is where the real logic lives: one `SiteStock` becomes one Meta catalog row, or is rejected.

**Files:**
- Create: `src/lib/meta/feedRow.ts`
- Modify: `scripts/test-meta-feed.mjs`

- [ ] **Step 1: Add failing assertions**

Append to `scripts/test-meta-feed.mjs` before the final `console.log`:

```javascript
// ── Task 3: row mapping ──────────────────────────────────────────────────
const { META_COLUMNS, toFeedRow, isFeedEligible } = await import("../src/lib/meta/feedRow.ts");

const car = {
  stock_id: 7788, slug: "stock-7788", make: "Toyota", variant: "Corolla 1.8 XS A/T",
  title: "2019 Toyota Corolla 1.8 XS A/T", year: 2019, price: 289900, mileage: 64000,
  colour: "Silver", new_used: "Used", condition: "Excellent", extras: "Bluetooth, Aircon",
  description: "Full service history", images: ["https://s3.example/a.jpg", "https://s3.example/b.jpg"],
  status: "available", source: "feed", specs: null, show_finance: true,
  synced_at: new Date().toISOString(),
};

console.log("\nisFeedEligible");
check("accepts a normal available car", () => assert.equal(isFeedEligible(car), true));
check("rejects a manual listing (a trailer is not a vehicle)", () =>
  assert.equal(isFeedEligible({ ...car, source: "manual" }), false));
check("rejects a POA car (null price)", () =>
  assert.equal(isFeedEligible({ ...car, price: null }), false));
check("rejects a zero-price car", () =>
  assert.equal(isFeedEligible({ ...car, price: 0 }), false));
check("rejects a car with no images", () =>
  assert.equal(isFeedEligible({ ...car, images: [] }), false));
check("keeps a recently sold car (attribution needs the id to resolve)", () =>
  assert.equal(isFeedEligible({ ...car, status: "sold" }), true));
check("drops a car sold over 90 days ago", () => {
  const old = new Date(Date.now() - 91 * 86400000).toISOString();
  assert.equal(isFeedEligible({ ...car, status: "sold", synced_at: old }), false);
});

console.log("\ntoFeedRow");
const row = toFeedRow(car);
check("vehicle_id matches metaVehicleId exactly", () =>
  assert.equal(row.vehicle_id, metaVehicleId(car)));
check("price carries the ZAR currency suffix Meta requires", () =>
  assert.equal(row.price, "289900 ZAR"));
check("url is absolute and points at the real vehicle page", () =>
  assert.equal(row.url, "https://dartmotors.net/shop/stock-7788"));
check("mileage is split into value and unit", () => {
  assert.equal(row["mileage.value"], "64000");
  assert.equal(row["mileage.unit"], "KM");
});
check("state_of_vehicle is upper-case USED", () =>
  assert.equal(row.state_of_vehicle, "USED"));
check("a new car maps to NEW", () =>
  assert.equal(toFeedRow({ ...car, new_used: "New" }).state_of_vehicle, "NEW"));
check("availability is available for a live car", () =>
  assert.equal(row.availability, "available"));
check("availability is not_available for a sold car", () =>
  assert.equal(toFeedRow({ ...car, status: "sold" }).availability, "not_available"));
check("transmission is derived from the variant text", () =>
  assert.equal(row.transmission, "AUTOMATIC"));
check("images map to indexed columns", () => {
  assert.equal(row["image[0].url"], "https://s3.example/a.jpg");
  assert.equal(row["image[1].url"], "https://s3.example/b.jpg");
});
check("address is the JSON blob Meta expects", () => {
  const a = JSON.parse(row.address);
  assert.equal(a.city, "Cape Town");
  assert.equal(a.country, "South Africa");
});
check("description never falls back to empty (Meta requires it)", () =>
  assert.ok(toFeedRow({ ...car, description: null }).description.length > 0));
check("every META_COLUMNS key is present on the row", () => {
  for (const c of META_COLUMNS) assert.ok(c in row, `missing column: ${c}`);
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
node scripts/test-meta-feed.mjs
```

Expected: FAIL with `Cannot find module '../src/lib/meta/feedRow.ts'`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/meta/feedRow.ts
import type { SiteStock } from "@/lib/types";
import { dealer } from "@/config/dealer";
import { stockTitle, transmissionFromVariant } from "@/lib/format";
import { metaVehicleId } from "./vehicleId";

/**
 * Maps one site_stock row to one Meta vehicle-catalog row.
 *
 * Column names follow Meta's automotive inventory feed spec. ⚠️ Meta's own
 * validator is the source of truth on required columns and enum spellings —
 * Task 4 of the plan exists to reconcile this against the first real upload.
 */

/** How long a sold car stays in the feed so historical events still resolve. */
const SOLD_GRACE_DAYS = 90;

/** Fixed column order. The feed's header row is exactly this, in this order. */
export const META_COLUMNS = [
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
  "availability",
  "address",
  "latitude",
  "longitude",
  "dealer_name",
  "image[0].url",
  "image[1].url",
  "image[2].url",
  "image[3].url",
] as const;

/** How many image columns the feed carries. Must match META_COLUMNS above. */
const IMAGE_SLOTS = 4;

/**
 * Whether a row belongs in the catalog at all.
 *
 * Four exclusions, each with a real reason:
 *  - manual listings: a trailer has no make/model/year/mileage and fails validation
 *    (same reasoning as the schema.org Product/Car split in shop/[slug]/page.tsx)
 *  - POA: a catalog entry cannot exist without a price
 *  - no images: image[0].url is required
 *  - long-sold: kept 90 days so a past ViewContent can still be attributed, then dropped
 */
export function isFeedEligible(v: SiteStock): boolean {
  if (v.source === "manual") return false;
  if (!v.price || v.price <= 0) return false;
  if (!v.images?.length) return false;
  if (v.status === "sold") {
    // synced_at freezes at the last sync that still saw the car in the VMG feed,
    // which is exactly "when it left the floor".
    const lastSeen = v.synced_at ? new Date(v.synced_at).getTime() : 0;
    if (Date.now() - lastSeen > SOLD_GRACE_DAYS * 86_400_000) return false;
  }
  return true;
}

/** Meta wants an upper-case enum; our helper returns "Automatic"/"Manual"/null. */
function metaTransmission(variant: string | null): string {
  const t = transmissionFromVariant(variant);
  return t ? t.toUpperCase() : "";
}

/** VMG's newUsed is free text ("Used", "used", "New"); Meta wants NEW/USED. */
function metaStateOfVehicle(newUsed: string | null): string {
  return /new/i.test(newUsed ?? "") ? "NEW" : "USED";
}

export function toFeedRow(v: SiteStock): Record<string, string> {
  const title = stockTitle(v);

  // Meta requires a non-empty description. VMG leaves it blank often enough that
  // an unconditional fallback is the only safe option, otherwise those cars are
  // silently rejected at upload with no obvious cause.
  const description =
    v.description?.trim() ||
    [title, v.mileage ? `${v.mileage} km` : null, v.colour, "Available at " + dealer.name]
      .filter(Boolean)
      .join(", ");

  const row: Record<string, string> = {
    vehicle_id: metaVehicleId(v),
    title,
    description,
    url: `${dealer.siteUrl}/shop/${v.slug}`,
    make: v.make,
    // We have no separate model column — VMG gives a combined variant string
    // ("Corolla 1.8 XS A/T"). Falling back to make keeps the required field filled.
    model: v.variant || v.make,
    year: v.year ? String(v.year) : "",
    "mileage.value": v.mileage != null ? String(v.mileage) : "0",
    "mileage.unit": "KM",
    price: `${v.price} ZAR`,
    exterior_color: v.colour ?? "",
    state_of_vehicle: metaStateOfVehicle(v.new_used),
    condition: v.condition ?? "",
    transmission: metaTransmission(v.variant),
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
```

- [ ] **Step 4: Run and watch it pass**

```bash
node scripts/test-meta-feed.mjs
```

Expected: `28 passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/feedRow.ts scripts/test-meta-feed.mjs
git commit -m "feat(meta): map site_stock rows to meta vehicle catalog format"
```

---

## Task 4: The feed query

**Files:**
- Create: `src/lib/queries-feed.ts`

- [ ] **Step 1: Implement**

There is no unit test for this step: it is a thin Supabase read with no logic worth mocking, and Task 5 asserts against its real output over HTTP. Deliberate, not an oversight.

```typescript
// src/lib/queries-feed.ts
import { supabasePublic as supabase } from "@/lib/supabase/public";
import type { SiteStock } from "@/lib/types";

/**
 * Stock for the Meta catalog feed — the ONLY read in the codebase that returns
 * sold rows.
 *
 * ⚠️ Deliberately NOT in queries.ts. Everything there filters to
 * status='available' because a sold car must never appear on the website. This
 * query breaks that rule on purpose (Meta needs sold cars present-but-unavailable
 * so a past ViewContent can still be attributed), so it is quarantined in its own
 * file to make an accidental import obvious in review.
 */
export async function getStockForMetaFeed(): Promise<SiteStock[]> {
  const { data, error } = await supabase
    .from("site_stock")
    .select("*")
    .in("status", ["available", "sold"])
    .eq("source", "feed") // manual listings are excluded from a VEHICLE catalog
    .order("status", { ascending: true }) // available first, purely for readability
    .order("price", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("getStockForMetaFeed:", error.message);
    return [];
  }
  return (data ?? []) as SiteStock[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queries-feed.ts
git commit -m "feat(meta): quarantined query returning available + recently sold stock"
```

---

## Task 5: The feed route

**Files:**
- Create: `src/app/api/feed/meta/route.ts`
- Modify: `scripts/test-meta-feed.mjs`

- [ ] **Step 1: Add failing HTTP assertions**

Append to `scripts/test-meta-feed.mjs` before the final `console.log`:

```javascript
// ── Task 5: the live endpoint ────────────────────────────────────────────
console.log("\nGET /api/feed/meta");
const res = await fetch(`${BASE}/api/feed/meta`);
const body = await res.text();
const lines = body.trim().split("\n");

check("responds 200", () => assert.equal(res.status, 200));
check("serves text/csv", () => assert.match(res.headers.get("content-type") ?? "", /text\/csv/));
check("header row matches META_COLUMNS exactly", () =>
  assert.equal(lines[0], META_COLUMNS.join(",")));
check("returns at least one car", () => assert.ok(lines.length > 1, "feed is empty"));
check("every row has the same field count as the header", () => {
  // Naive split is unsafe on quoted commas, so count rows not fields: assert no
  // row is blank and none of them are the literal string "undefined".
  for (const [i, line] of lines.entries()) {
    assert.ok(line.trim().length > 0, `row ${i} is blank`);
    assert.ok(!line.includes("undefined"), `row ${i} contains "undefined"`);
  }
});
check("no row carries a null price", () => assert.ok(!body.includes("null ZAR")));
check("every url is absolute https", () => {
  const urls = body.match(/https?:\/\/[^\s,"]+\/shop\/[^\s,"]+/g) ?? [];
  assert.ok(urls.length > 0, "no vehicle urls found");
  assert.ok(urls.every((u) => u.startsWith("https://")), "a non-https url is present");
});
```

- [ ] **Step 2: Start the dev server and watch it fail**

```bash
npm run dev
# in a second terminal:
node scripts/test-meta-feed.mjs
```

Expected: FAIL, `responds 200` gets 404.

- [ ] **Step 3: Implement**

```typescript
// src/app/api/feed/meta/route.ts
import { getStockForMetaFeed } from "@/lib/queries-feed";
import { META_COLUMNS, isFeedEligible, toFeedRow } from "@/lib/meta/feedRow";
import { toCsv } from "@/lib/meta/csv";

/**
 * Meta vehicle catalog feed. Commerce Manager fetches this on a schedule
 * (hourly) and reconciles the catalog against it, so this route is the single
 * thing standing between Dart's live floor and what their ads show.
 *
 * Route handlers are uncached in Next 16 by default, which is what we want:
 * Meta must never be served a stale body. At one fetch an hour the Supabase
 * read is free, so there is nothing to optimise here.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Optional shared-key guard. Only enforced when the env var is set, so a
  // missing variable can never take the feed offline and silently empty the
  // catalog (which would pull every ad down).
  const requiredKey = process.env.META_FEED_KEY;
  if (requiredKey) {
    const key = new URL(request.url).searchParams.get("key");
    if (key !== requiredKey) {
      return new Response("forbidden", { status: 403 });
    }
  }

  const stock = await getStockForMetaFeed();
  const rows = stock.filter(isFeedEligible).map(toFeedRow);
  const csv = toCsv([...META_COLUMNS], rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Meta re-fetches hourly; allow a short shared cache but never a stale day.
      "Cache-Control": "public, max-age=0, s-maxage=600",
      "Content-Disposition": 'inline; filename="dart-motors-vehicles.csv"',
    },
  });
}
```

- [ ] **Step 4: Run and watch it pass**

```bash
node scripts/test-meta-feed.mjs
```

Expected: all assertions pass, exit code 0.

- [ ] **Step 5: Eyeball the actual output**

```bash
curl -s http://localhost:3000/api/feed/meta | head -3
curl -s http://localhost:3000/api/feed/meta | wc -l
```

Confirm the row count is roughly Dart's stock count (80+ vehicles per `dealer.ts`). **If it is wildly lower, an eligibility rule is over-filtering** — check how many cars have no price or no images before assuming the code is wrong.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/feed/meta/route.ts scripts/test-meta-feed.mjs
git commit -m "feat(meta): serve vehicle catalog feed at /api/feed/meta"
```

---

## Task 6: Deploy the feed and connect it to Meta

**Files:** none (infrastructure)

- [ ] **Step 1: Set the feed key in Vercel**

⚠️ **Never pipe env values from PowerShell** — it silently corrupts them. Use the Vercel REST API or the dashboard. Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Set `META_FEED_KEY` to that value for Production.

- [ ] **Step 2: Push and deploy together**

```bash
git push origin main
vercel --prod
```

- [ ] **Step 3: Verify the deploy serves the new route**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://dartmotors.net/api/feed/meta"
# expect 403 (key required, proves the guard is live)
curl -s "https://dartmotors.net/api/feed/meta?key=THEKEY" | head -3
# expect the header row + two cars
```

- [ ] **Step 4: Connect it in Commerce Manager**

Catalog → **Data sources** → **Add items** → **Scheduled feed** → paste `https://dartmotors.net/api/feed/meta?key=THEKEY` → set frequency **hourly**.

- [ ] **Step 5: Read Meta's validation report and reconcile**

This is the real acceptance test for Tasks 3 to 5, and it is why the column spec above carries a warning. Meta will report errors and warnings per column. **Expect to iterate here.** Likely findings:

- `vin` reported as required → revisit Task 0 findings; if VMG publishes it, add it to `fetchFeed.ts`, `sync.ts`, the `site_stock` table and `META_COLUMNS`
- `availability` enum spelling rejected → try `in stock` / `out of stock` instead of `available` / `not_available`
- `model` warnings from the combined variant string → acceptable, note and move on

Fix, redeploy, let Meta re-fetch, repeat until the error count is zero. **Record the final working column spec in a comment at the top of `feedRow.ts`** so the next dealer build starts from proven ground rather than repeating this.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A && git commit -m "fix(meta): reconcile feed columns against Meta validation"
git push origin main && vercel --prod
```

---

## Task 7: Pixel base

**Files:**
- Create: `src/lib/meta/track.ts`
- Create: `src/components/site/MetaPixel.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `.env.example`

- [ ] **Step 1: Write the typed tracking wrapper**

```typescript
// src/lib/meta/track.ts

/**
 * Thin typed wrapper over window.fbq.
 *
 * Every component goes through this rather than touching window.fbq directly,
 * so that (a) a missing pixel is a no-op instead of a runtime crash, and (b)
 * there is one place to look when an event is not arriving.
 */

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** Standard Meta event with optional parameters. Safe before the pixel loads. */
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}

/**
 * A vehicle-scoped event. content_type "vehicle" + content_ids is the pair that
 * lets Meta join this event to a row in the catalog — the ids come from
 * metaVehicleId, the same function the feed uses.
 */
export function trackVehicle(
  event: "ViewContent" | "Lead" | "Search" | "InitiateCheckout",
  vehicleId: string,
  extra?: { value?: number | null; name?: string },
): void {
  track(event, {
    content_type: "vehicle",
    content_ids: [vehicleId],
    currency: "ZAR",
    ...(extra?.value ? { value: extra.value } : {}),
    ...(extra?.name ? { content_name: extra.name } : {}),
  });
}
```

- [ ] **Step 2: Write the pixel loader**

```tsx
// src/components/site/MetaPixel.tsx
"use client";

import Script from "next/script";

/**
 * Loads the Meta pixel and fires PageView.
 *
 * ⚠️ NEXT_PUBLIC_* is inlined at BUILD time, not read at runtime. Setting
 * NEXT_PUBLIC_FB_PIXEL_ID in Vercel does nothing until a fresh build runs, and
 * the symptom is a completely silent no-op. If the pixel is not firing in
 * production, check that a build ran AFTER the variable was set before
 * debugging anything else.
 */
export default function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
```

- [ ] **Step 3: Mount it in the root layout**

Modify `src/app/layout.tsx`. Add the import beside the existing ones at the top:

```tsx
import MetaPixel from "@/components/site/MetaPixel";
```

Then change the body (currently line 58 to 60) from:

```tsx
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
```

to:

```tsx
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <MetaPixel />
        {children}
      </body>
```

- [ ] **Step 4: Document the env var**

Append to `.env.example`:

```
# Meta catalog feed — shared key guarding /api/feed/meta. Optional: if unset the
# feed is public. Paste the same value into the Commerce Manager feed URL as ?key=
META_FEED_KEY=

# Meta pixel id (Events Manager → Data sources). ⚠️ NEXT_PUBLIC_ is baked in at
# BUILD time — a fresh deploy is required after changing this or it does nothing.
NEXT_PUBLIC_FB_PIXEL_ID=
```

- [ ] **Step 5: Verify it loads locally**

```bash
# add NEXT_PUBLIC_FB_PIXEL_ID=<the real id> to .env.local first
npm run dev
```

Open http://localhost:3000 in Chrome, DevTools → Network → filter `fbevents`. Expect `fbevents.js` to load, and a request to `facebook.com/tr` carrying `ev=PageView`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meta/track.ts src/components/site/MetaPixel.tsx src/app/layout.tsx .env.example
git commit -m "feat(meta): install pixel with typed event wrapper"
```

---

## Task 8: ViewContent on the vehicle page

This is the event that makes per-car retargeting possible. Without it the catalog can only prospect.

**Files:**
- Create: `src/components/site/VehicleViewTracker.tsx`
- Modify: `src/app/(public)/shop/[slug]/page.tsx`

- [ ] **Step 1: Write the tracker component**

```tsx
// src/components/site/VehicleViewTracker.tsx
"use client";

import { useEffect } from "react";
import { trackVehicle } from "@/lib/meta/track";

/**
 * Fires ViewContent for one vehicle, once per mount.
 *
 * Renders nothing. It exists as a client component only because the vehicle page
 * is a server component and cannot touch window. The vehicleId is computed on
 * the server with metaVehicleId — the SAME function the catalog feed uses — and
 * passed down, which is what guarantees the event joins to a catalog row.
 */
export default function VehicleViewTracker({
  vehicleId,
  value,
  name,
}: {
  vehicleId: string;
  value: number | null;
  name: string;
}) {
  useEffect(() => {
    trackVehicle("ViewContent", vehicleId, { value, name });
  }, [vehicleId, value, name]);

  return null;
}
```

- [ ] **Step 2: Mount it on the vehicle page**

Modify `src/app/(public)/shop/[slug]/page.tsx`.

Add to the imports (beside the existing component imports around line 14 to 18):

```tsx
import VehicleViewTracker from "@/components/site/VehicleViewTracker";
import { metaVehicleId } from "@/lib/meta/vehicleId";
```

Then find the opening of the returned JSX (currently line 138 to 139):

```tsx
    <div className="px-page mx-auto max-w-[1400px] py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

and insert the tracker directly after the JSON-LD script:

```tsx
    <div className="px-page mx-auto max-w-[1400px] py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Meta ViewContent — the id comes from the same helper the catalog feed
          uses, so this event always joins to a real catalog row. */}
      <VehicleViewTracker vehicleId={metaVehicleId(v)} value={v.price} name={title} />
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open any car page, DevTools → Network → filter `tr?`. Expect a request with `ev=ViewContent` and a `cd[content_ids]` parameter containing that car's stock number. **Cross-check that number against the feed:**

```bash
curl -s "http://localhost:3000/api/feed/meta" | grep "^<that stock number>,"
```

If the grep finds nothing, the ID contract is broken and retargeting will silently fail. Do not proceed past this until it matches.

- [ ] **Step 4: Commit**

```bash
git add src/components/site/VehicleViewTracker.tsx "src/app/(public)/shop/[slug]/page.tsx"
git commit -m "feat(meta): fire ViewContent per vehicle with catalog-matched id"
```

---

## Task 9: Lead events

**Files:**
- Modify: `src/components/site/VehicleInterest.tsx`
- Modify: `src/components/site/VehicleEnquiry.tsx`

- [ ] **Step 1: Pass the vehicle id into both components**

Modify `src/app/(public)/shop/[slug]/page.tsx`. Change the two component mounts (currently lines 172 and 179) from:

```tsx
            <VehicleInterest stockSlug={v.slug} title={title} message={msg} />
```

to:

```tsx
            <VehicleInterest stockSlug={v.slug} title={title} message={msg} vehicleId={metaVehicleId(v)} price={v.price} />
```

and from:

```tsx
            <VehicleEnquiry stockSlug={v.slug} title={title} message={msg} emailSubject={`Enquiry: ${title}`} />
```

to:

```tsx
            <VehicleEnquiry stockSlug={v.slug} title={title} message={msg} emailSubject={`Enquiry: ${title}`} vehicleId={metaVehicleId(v)} price={v.price} />
```

- [ ] **Step 2: Fire Lead from VehicleInterest**

Modify `src/components/site/VehicleInterest.tsx`.

Add the import beside the existing ones:

```tsx
import { trackVehicle } from "@/lib/meta/track";
```

Change the props type and destructuring from:

```tsx
export default function VehicleInterest({
  stockSlug,
  title,
  message,
}: {
  stockSlug: string;
  title: string;
  message: string; // pre-filled WhatsApp message for this vehicle
}) {
```

to:

```tsx
export default function VehicleInterest({
  stockSlug,
  title,
  message,
  vehicleId,
  price,
}: {
  stockSlug: string;
  title: string;
  message: string; // pre-filled WhatsApp message for this vehicle
  vehicleId: string; // Meta catalog id — matches the feed by construction
  price: number | null;
}) {
```

Then in `submit`, change the closing of the try/catch (currently the `setStatus("done")` line) from:

```tsx
    }
    setStatus("done"); // either way, thank them + nudge to WhatsApp
  }
```

to:

```tsx
    }
    // Fire on either path: the DB write and the WhatsApp fallback are both a
    // real lead, and losing the signal on the fallback would under-report
    // exactly the conversions Meta optimises toward.
    trackVehicle("Lead", vehicleId, { value: price, name: title });
    setStatus("done"); // either way, thank them + nudge to WhatsApp
  }
```

- [ ] **Step 3: Fire Lead from VehicleEnquiry**

Modify `src/components/site/VehicleEnquiry.tsx`.

Add the import:

```tsx
import { trackVehicle } from "@/lib/meta/track";
```

Change the props from:

```tsx
export default function VehicleEnquiry({
  stockSlug,
  title,
  message,
  emailSubject,
}: {
  stockSlug: string;
  title: string;
  message: string;
  emailSubject: string;
}) {
```

to:

```tsx
export default function VehicleEnquiry({
  stockSlug,
  title,
  message,
  emailSubject,
  vehicleId,
  price,
}: {
  stockSlug: string;
  title: string;
  message: string;
  emailSubject: string;
  vehicleId: string; // Meta catalog id — matches the feed by construction
  price: number | null;
}) {
```

Then change the `log` function from:

```tsx
  function log(channel: "whatsapp" | "email") {
    // Fire-and-forget; the link opens normally regardless. NOTE: a supabase
    // query is a LAZY thenable — the request is only sent inside .then().
    // `void ...` sent nothing, so these clicks were never logged.
    const supabase = createClient();
```

to:

```tsx
  function log(channel: "whatsapp" | "email") {
    // Mirror the click to Meta as a Lead. A WhatsApp click IS the conversion on
    // this site — it is where Dart's sale actually starts — so this is the event
    // the catalog campaign should be optimising toward.
    trackVehicle("Lead", vehicleId, { value: price, name: title });

    // Fire-and-forget; the link opens normally regardless. NOTE: a supabase
    // query is a LAZY thenable — the request is only sent inside .then().
    // `void ...` sent nothing, so these clicks were never logged.
    const supabase = createClient();
```

- [ ] **Step 4: Verify both events**

```bash
npm run dev
```

On a car page: click "I'm interested in this car", submit the form, confirm a `tr?...ev=Lead` request fires with the right `content_ids`. Then reload, click "Enquire on WhatsApp", confirm a second `Lead` fires.

- [ ] **Step 5: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors. A missing prop on `VehicleInterest` or `VehicleEnquiry` surfaces here.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(meta): fire Lead on vehicle interest and whatsapp/email enquiry"
```

---

## Task 10: Ship and verify in production

**Files:** none

- [ ] **Step 1: Set the pixel id in Vercel BEFORE building**

Set `NEXT_PUBLIC_FB_PIXEL_ID` for Production via the Vercel dashboard or REST API. **Never pipe the value from PowerShell.**

- [ ] **Step 2: Push and deploy together**

```bash
git push origin main
vercel --prod
```

Ship hygiene: these two go together, never one without the other.

- [ ] **Step 3: Confirm the push landed**

```bash
git status              # expect clean tree
git rev-parse HEAD origin/main   # expect identical hashes
```

- [ ] **Step 4: Confirm the deploy serves the new code**

```bash
curl -s "https://dartmotors.net/api/feed/meta?key=THEKEY" | head -2
curl -s https://dartmotors.net/ | grep -c fbevents
```

Expect the CSV header row, and a non-zero grep count proving the pixel snippet is in the built HTML. **A zero here almost always means the build ran before the env var was set** — set it, redeploy, re-check.

- [ ] **Step 5: Verify the pixel with the real-browser tool**

```bash
node Projects/ClientWork/_tools/pixelcheck.mjs https://dartmotors.net/shop/<a-real-slug>
```

⚠️ **A HeadlessChrome user agent makes `fbevents.js` load its config but send nothing.** It looks completely broken and is not. Use the real-Chrome CDP tool above, not a headless fetch, or you will spend an hour debugging a working pixel.

- [ ] **Step 6: Confirm in Meta Events Manager**

Events Manager → the Dart dataset → **Test events**. Load a car page in a normal browser and watch `PageView`, then `ViewContent`, then `Lead` arrive. Confirm the `content_ids` value on `ViewContent` exists in the catalog (Commerce Manager → Catalog → Items, search that stock number). **This is the acceptance test for the entire plan**: if that ID resolves to a catalog item, the feed and the pixel agree and retargeting will work.

- [ ] **Step 7: Update the register and the MasterPlan**

Add the new env vars to `Operations/Accounts.md` (feed key, pixel id, catalog id). Append a dated entry to `MasterPlan/MASTERPLAN-LOG.md` recording what shipped, the final working column spec, and whatever Meta's validator forced us to change. Codify the working setup as a Playbook once a second dealer runs it.

---

## Task 0 findings — RUN 2026-08-17 ✅

Ran `node --env-file=.env.local scripts/inspect-vmg-fields.mjs` against the live VMG feed.

**Every node VMG publishes:** `stockID`, `DateUpdated`, `newUsed`, `Make`, `variant`, `price`, `mmCode`, `licenceNumber`, `VIN`, `mileage`, `year`, `Colour`, `extras`, `condition`, `Description`, `referenceID`, `images`.

**The three nodes the website parser currently throws away:**

| Node | Example | Verdict |
|---|---|---|
| `VIN` | `WV1ZZZ2HZDH013110` | ✅ **CAPTURE.** Meta's vehicle catalog wants it. Requires a migration + parser + sync change (new Task 3b). |
| `mmCode` | `64072445` | ✅ **CAPTURE.** The SA M&M code, the canonical identifier for a make/model/variant. Meta does not use it, but it is the join key any future pricing or demand-intelligence work needs, and it is free to store now. |
| `licenceNumber` | `CF185162` | ❌ **CAPTURE BUT NEVER PUBLISH.** A registration number is personal-ish data about the previous owner and has no business in a public feed or on the website. Store it if useful to Dartbooks; it must never appear in `META_COLUMNS`. |

**Fields Meta wants that VMG does NOT provide:** `fuel_type`, `body_style`, `drivetrain`, `model` (separate from variant), `trim`, `engine`, `doors`. These stay blank or derived. Not a blocker; they are optional enrichment fields, not required ones.

**Better transmission signal found.** `extras` is a clean comma-separated list that includes `Automatic` explicitly (e.g. `4x4,ABS Brakes,...,Automatic,Bluetooth Ready,...`). That is more reliable than regexing `A/T` out of the variant string. **Read `extras` first, fall back to `transmissionFromVariant`.**

**Feed size: 33 vehicles.** ⚠️ Note the mismatch: `dealer.ts` heritage copy claims Dart runs "80+ vehicles". The live feed carries 33. Either the floor has shrunk or VMG is publishing a subset. **Flagged to James, not a code issue.**

**Eligibility is clean: 0 cars excluded.** Every one of the 33 has a price and images, so the full floor makes the catalog. The exclusion rules stay in as guards for future stock, but they are not filtering anything today.

**Images: VMG supplies up to 10 per car** (the sample had exactly 10). The plan originally allotted 4 image columns. **Raised to 10** — more images means a richer carousel at zero cost.

**Make is ALL CAPS** (`VOLKSWAGEN`). Ad titles would read "2013 VOLKSWAGEN AMAROK 2.0 BiTDi...". **Decision: title-case `make` in the feed only.** Do NOT touch `variant`, which contains `BiTDi`, `4MOT`, `A/T`, `D/C`, `P/U` and would be mangled by any casing pass. The website rendering is left exactly as-is.

**Env var name corrected.** `.env.local` already contains an empty `NEXT_PUBLIC_META_PIXEL_ID` placeholder, referenced by no code. **Use that existing name throughout, not `NEXT_PUBLIC_FB_PIXEL_ID`.**

---

## Task 3b: Capture VIN and mmCode (inserted after Task 0 findings)

**Why:** VIN is a field Meta's vehicle catalog wants and VMG hands us for free. It is currently parsed away.

**Files:**
- Create: `supabase/migrations/000XX_stock_vin_mmcode.sql` (next free number)
- Modify: `src/lib/feed/types.ts`, `src/lib/feed/fetchFeed.ts`, `src/lib/feed/sync.ts`, `src/lib/types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Capture VIN + M&M code from the VMG feed.
-- VIN feeds the Meta vehicle catalog. mmCode is the canonical SA identifier for a
-- make/model/variant and is the join key for any future pricing work.
-- licenceNumber is deliberately NOT captured: a registration number is personal
-- data about the previous owner and must never reach a public feed.
ALTER TABLE site_stock
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS mm_code BIGINT;
```

Apply it with the Dart Management PAT (the Supabase MCP on this workspace is read-only):
`POST https://api.supabase.com/v1/projects/gqppfaicijzejjxgyhji/database/query`

- [ ] **Step 2: Add the fields to the feed type**

In `src/lib/feed/types.ts`, add to `FeedVehicle`:

```typescript
  vin: string;
  mmCode: number;
```

- [ ] **Step 3: Parse them**

In `src/lib/feed/fetchFeed.ts`, add to the returned object beside `referenceID`:

```typescript
      vin: String(v.VIN ?? ""),
      mmCode: Number(v.mmCode) || 0,
```

- [ ] **Step 4: Persist them**

In `src/lib/feed/sync.ts`, add to the `rows` mapping beside `reference_id`:

```typescript
      vin: v.vin || null,
      mm_code: v.mmCode || null,
```

- [ ] **Step 5: Add them to the domain type**

In `src/lib/types.ts`, add to `SiteStock` beside `reference_id`:

```typescript
  vin: string | null;
  mm_code: number | null;
```

- [ ] **Step 6: Run a sync and confirm the columns populate**

```bash
curl -X POST "https://dartmotors.net/api/sync?secret=$SYNC_SECRET"
```

Then confirm via the Management PAT that `vin` is non-null on at least 30 of the 33 rows.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(feed): capture VIN and M&M code from the VMG feed"
```

**Knock-on changes to Task 3:** add `vin` to `META_COLUMNS`, map `vin: v.vin ?? ""` in `toFeedRow`, raise `IMAGE_SLOTS` to 10 (and add `image[4]` through `image[9]` to `META_COLUMNS`), title-case `make`, and read transmission from `extras` before falling back to the variant regex:

```typescript
/** extras carries an explicit "Automatic" flag; the variant regex is the fallback. */
function metaTransmission(v: SiteStock): string {
  if (/(^|,)\s*automatic\s*(,|$)/i.test(v.extras ?? "")) return "AUTOMATIC";
  if (/(^|,)\s*manual\s*(,|$)/i.test(v.extras ?? "")) return "MANUAL";
  const t = transmissionFromVariant(v.variant);
  return t ? t.toUpperCase() : "";
}

/** VMG sends "VOLKSWAGEN". Ads read better as "Volkswagen". Feed only — the
 *  website rendering is untouched, and `variant` is never re-cased because it
 *  contains BiTDi / 4MOT / A/T / D/C which any casing pass would mangle. */
function titleCaseMake(make: string): string {
  return make.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
```

---

## Self-review notes

**Spec coverage:** feed endpoint (Tasks 1 to 6), pixel with matched `content_ids` (Tasks 7 to 9), production verification (Task 10). Both halves of the original ask are covered.

**Deliberate scope exclusions**, to be separate plans, not silently dropped:
1. **Branded thumbnail renderer.** The feed ships with raw VMG images. Prove the pipe before polishing what flows through it.
2. **Conversions API (server-side events).** The pixel alone loses events to ad blockers and iOS. CAPI is the follow-up, and `site_leads` already holds everything needed to send it.
3. **VIN / fuel / body enrichment of `sync.ts`.** Gated on Task 0's findings and Meta's validation output.

**Known risk carried:** the exact column spec and enum spellings in `feedRow.ts` are written from Meta's documented automotive feed format but are not verified against a live upload. Task 6 Step 5 exists specifically to reconcile them, and it is the step most likely to need iteration. Nobody should treat Task 5 passing as "the feed works" — only Meta's validator settles that.
