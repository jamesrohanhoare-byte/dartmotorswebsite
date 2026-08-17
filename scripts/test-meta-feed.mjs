// Verification for the Meta catalog feed.
//
// There is no test framework in this repo by design (see
// docs/superpowers/plans/2026-08-17-meta-catalog-feed-and-pixel.md). The house
// pattern is standalone assertion scripts, so that is what this is.
//
// Pure-logic checks run standalone. The endpoint checks need a dev server:
//   npm run dev
//   node scripts/test-meta-feed.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Node has no idea about tsconfig's "@/*" path alias, so teach it. Must run
// before any dynamic import below. Node 24 strips TypeScript natively, so the
// .ts sources load directly with no build step.
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) {
      const rest = spec.slice(2);
      const file = /\.[a-z]+$/.test(rest) ? rest : `${rest}.ts`;
      return { url: new URL(`../src/${file}`, import.meta.url).href, shortCircuit: true };
    }
    // TypeScript omits file extensions on relative imports; Node ESM requires them.
    if (/^\.\.?\//.test(spec) && !/\.[a-z]+$/.test(spec)) {
      return next(`${spec}.ts`, ctx);
    }
    return next(spec, ctx);
  },
});

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

// ── The shared id ────────────────────────────────────────────────────────
const { metaVehicleId } = await import("../src/lib/meta/vehicleId.ts");

console.log("\nmetaVehicleId");
check("returns the stock id as a string", () =>
  assert.equal(metaVehicleId({ stock_id: 12345 }), "12345"));
check("is a string, never a number (Meta matches on string equality)", () =>
  assert.equal(typeof metaVehicleId({ stock_id: 12345 }), "string"));
check("handles a zero stock id without returning empty", () =>
  assert.equal(metaVehicleId({ stock_id: 0 }), "0"));

// ── CSV serialisation ────────────────────────────────────────────────────
const { toCsv } = await import("../src/lib/meta/csv.ts");

console.log("\ntoCsv");
check("writes the header row in the given column order", () =>
  assert.equal(toCsv(["b", "a"], [{ a: "1", b: "2" }]).split("\n")[0], "b,a"));
check("orders values to match the header, not the object", () =>
  assert.equal(toCsv(["b", "a"], [{ a: "1", b: "2" }]).split("\n")[1], "2,1"));
check("quotes a value containing a comma", () =>
  assert.equal(toCsv(["a"], [{ a: "Woodstock, Cape Town" }]).split("\n")[1], '"Woodstock, Cape Town"'));
check("doubles an embedded quote (RFC4180)", () =>
  assert.equal(toCsv(["a"], [{ a: 'the 5" screen' }]).split("\n")[1], '"the 5"" screen"'));
check("quotes a value containing a newline", () =>
  assert.equal(toCsv(["a"], [{ a: "line1\nline2" }]).split("\n")[1], '"line1'));
check("renders a missing key as empty, not the string undefined", () =>
  assert.equal(toCsv(["a", "z"], [{ a: "1" }]).split("\n")[1], "1,"));

// ── Row mapping ──────────────────────────────────────────────────────────
const { META_COLUMNS, toFeedRow, isFeedEligible } = await import("../src/lib/meta/feedRow.ts");

// Modelled on a real VMG row (stock 267) so the assertions reflect live data.
const car = {
  stock_id: 267, slug: "stock-267", make: "VOLKSWAGEN",
  variant: "AMAROK 2.0 BiTDi HIGHLINE 132KW 4MOT A/T D/C P/U",
  title: "2013 VOLKSWAGEN AMAROK 2.0 BiTDi HIGHLINE 132KW 4MOT A/T D/C P/U",
  year: 2013, price: 229995, mileage: 236139, colour: "Silver", new_used: "Used",
  condition: "Good", extras: "4x4,ABS Brakes,Air Conditioning,Automatic,Bluetooth Ready",
  description: "A stunning double cab bakkie!!", vin: "WV1ZZZ2HZDH013110",
  images: ["https://s3.example/a.jpg", "https://s3.example/b.jpg"],
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
check("drops a car sold over 90 days ago", () =>
  assert.equal(isFeedEligible({
    ...car, status: "sold",
    synced_at: new Date(Date.now() - 91 * 86400000).toISOString(),
  }), false));

console.log("\ntoFeedRow");
const row = toFeedRow(car);
check("vehicle_id matches metaVehicleId exactly", () =>
  assert.equal(row.vehicle_id, metaVehicleId(car)));
check("price carries the ZAR currency suffix Meta requires", () =>
  assert.equal(row.price, "229995 ZAR"));
check("url is absolute and points at the real vehicle page", () =>
  assert.equal(row.url, "https://dartmotors.net/shop/stock-267"));
check("mileage is split into value and unit", () => {
  assert.equal(row["mileage.value"], "236139");
  assert.equal(row["mileage.unit"], "KM");
});
check("make is title-cased for ad headlines", () =>
  assert.equal(row.make, "Volkswagen"));
check("variant is NOT re-cased (BiTDi / 4MOT / A-T would be mangled)", () =>
  assert.ok(row.model.includes("BiTDi") && row.model.includes("4MOT")));
check("state_of_vehicle is upper-case USED", () =>
  assert.equal(row.state_of_vehicle, "USED"));
check("a new car maps to NEW", () =>
  assert.equal(toFeedRow({ ...car, new_used: "New" }).state_of_vehicle, "NEW"));
check("availability is available for a live car", () =>
  assert.equal(row.availability, "available"));
check("availability is not_available for a sold car", () =>
  assert.equal(toFeedRow({ ...car, status: "sold" }).availability, "not_available"));
check("transmission is read from the extras list, not the variant regex", () =>
  assert.equal(row.transmission, "AUTOMATIC"));
check("transmission still falls back to the variant when extras is silent", () =>
  assert.equal(toFeedRow({ ...car, extras: "Aircon,Radio" }).transmission, "AUTOMATIC"));
check("vin is carried through", () =>
  assert.equal(row.vin, "WV1ZZZ2HZDH013110"));
check("a missing vin renders empty, never the string undefined", () =>
  assert.equal(toFeedRow({ ...car, vin: undefined }).vin, ""));
check("images map to indexed columns", () => {
  assert.equal(row["image[0].url"], "https://s3.example/a.jpg");
  assert.equal(row["image[1].url"], "https://s3.example/b.jpg");
});
check("unused image slots are empty", () =>
  assert.equal(row["image[9].url"], ""));
check("address is the JSON blob Meta expects", () => {
  const a = JSON.parse(row.address);
  assert.equal(a.city, "Cape Town");
  assert.equal(a.country, "South Africa");
});
check("description never falls back to empty (Meta requires it)", () =>
  assert.ok(toFeedRow({ ...car, description: null }).description.length > 0));
check("description is flattened to one line (parser-safety)", () =>
  assert.equal(
    toFeedRow({ ...car, description: "Line one!!\nLine two!!\n\nLine three" }).description,
    "Line one!! Line two!! Line three",
  ));
check("the licence number never appears anywhere in the row", () =>
  assert.ok(!JSON.stringify(row).includes("CF185162")));
check("every META_COLUMNS key is present on the row", () => {
  for (const c of META_COLUMNS) assert.ok(c in row, `missing column: ${c}`);
});

// ── The live endpoint (skipped if no dev server is running) ──────────────
console.log("\nGET /api/feed/meta");
let res;
try {
  res = await fetch(`${BASE}/api/feed/meta`);
} catch {
  console.log("  ⏭️  skipped — no server at " + BASE + " (run: npm run dev)");
}

if (res) {
  const body = await res.text();
  const lines = body.trim().split("\n");
  check("responds 200", () => assert.equal(res.status, 200));
  check("serves text/csv", () =>
    assert.match(res.headers.get("content-type") ?? "", /text\/csv/));
  check("header row matches META_COLUMNS exactly", () =>
    assert.equal(lines[0], META_COLUMNS.join(",")));
  check("returns at least one car", () => assert.ok(lines.length > 1, "feed is empty"));
  check("no row is blank or contains the string undefined", () => {
    for (const [i, line] of lines.entries()) {
      assert.ok(line.trim().length > 0, `row ${i} is blank`);
      assert.ok(!line.includes("undefined"), `row ${i} contains "undefined"`);
    }
  });
  check("quotes balance on every line (no field spans two lines)", () => {
    // Descriptions are flattened at source precisely so this holds. An odd
    // number of quotes on a line means a quoted field is still open at the line
    // break, i.e. a record spans lines — which third-party CSV parsers
    // routinely get wrong, and a feed that fails to parse takes every catalog
    // ad down with it.
    for (const [i, line] of lines.entries()) {
      const quotes = (line.match(/"/g) ?? []).length;
      assert.equal(quotes % 2, 0, `row ${i} has unbalanced quotes (field spans lines)`);
    }
  });
  check("every row has the same field count as the header", () => {
    const expected = META_COLUMNS.length;
    for (const [i, line] of lines.slice(1).entries()) {
      // Safe because no field contains a newline; commas inside quotes still
      // need respecting, so count only commas outside quotes.
      let inQuotes = false, fields = 1;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === "," && !inQuotes) fields++;
      }
      assert.equal(fields, expected, `row ${i + 1} has ${fields} fields, expected ${expected}`);
    }
  });
  check("no row carries a null price", () => assert.ok(!body.includes("null ZAR")));
  check("every vehicle url is absolute https", () => {
    const urls = body.match(/https?:\/\/[^\s,"]+\/shop\/[^\s,"]+/g) ?? [];
    assert.ok(urls.length > 0, "no vehicle urls found");
    assert.ok(urls.every((u) => u.startsWith("https://")), "a non-https url is present");
  });
  console.log(`\n  feed contains ${lines.length - 1} vehicles`);
}

console.log(`\n${passed} passed`);
