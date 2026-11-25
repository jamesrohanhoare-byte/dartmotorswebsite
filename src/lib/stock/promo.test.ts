import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPromo } from "./promo.ts";
import { PROMOS } from "../../config/promos.ts";

// Run: npm test

const NOW = Date.parse("2026-11-26T10:00:00.000Z");
const ENDS = "2026-12-02T21:59:00.000Z";
const promos = (o: Record<string, unknown> = {}) => ({
  "stock-1102": { price: 299995, label: "Black Friday Special", endsAt: ENDS, ...o },
});
const hilux = { slug: "stock-1102", price: 319995 };

test("an active promo swaps the price and keeps the old one as was_price", () => {
  const v = applyPromo(hilux, NOW, promos());
  assert.equal(v.price, 299995);
  assert.equal(v.was_price, 319995);
  assert.equal(v.promo_label, "Black Friday Special");
});

test("a promo past its end date is ignored, the feed price comes back", () => {
  const v = applyPromo(hilux, Date.parse(ENDS) + 1, promos());
  assert.equal(v.price, 319995);
  assert.equal(v.was_price, null);
  assert.equal(v.promo_label, null);
});

test("a promo with no end date never runs (nothing may linger)", () => {
  assert.equal(applyPromo(hilux, NOW, promos({ endsAt: "" })).was_price, null);
});

test("if VMG drops the real price to or below the promo, the promo stands down", () => {
  assert.equal(applyPromo({ ...hilux, price: 299995 }, NOW, promos()).price, 299995);
  assert.equal(applyPromo({ ...hilux, price: 289995 }, NOW, promos()).price, 289995);
  assert.equal(applyPromo({ ...hilux, price: 289995 }, NOW, promos()).was_price, null);
});

test("POA cars never take a promo", () => {
  assert.equal(applyPromo({ ...hilux, price: null }, NOW, promos()).was_price, null);
});

test("a car not on the list passes through untouched", () => {
  const v = applyPromo({ slug: "stock-1", price: 100000 }, NOW, promos());
  assert.equal(v.price, 100000);
  assert.equal(v.was_price, null);
});

// Guards on the REAL Black Friday list: these are the prices Geoff gave, posted
// on Facebook and Instagram on 2026-11-25. A typo here contradicts the posts.
test("Black Friday 2026 list matches Geoff's prices exactly", () => {
  const want: Record<string, number> = {
    "stock-1102": 299995, "stock-1054": 469995, "stock-1017": 279995, "stock-922": 309995,
    "stock-1043": 99995, "stock-902": 289995, "stock-893": 79995,
  };
  assert.deepEqual(Object.fromEntries(Object.entries(PROMOS).map(([k, p]) => [k, p.price])), want);
  for (const p of Object.values(PROMOS)) assert.ok(Date.parse(p.endsAt) > NOW);
});
