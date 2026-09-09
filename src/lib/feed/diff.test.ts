import { test } from "node:test";
import assert from "node:assert/strict";
import { diffStock, type FeedRow } from "./diff.ts";

// Run: npm test  (Node 24 strips the types itself, no runner to install)

function car(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    slug: "stock-820",
    stock_id: 820,
    make: "Toyota",
    variant: "Hilux 2.8 GD-6",
    title: "2021 Toyota Hilux 2.8 GD-6",
    year: 2021,
    price: 549995,
    mileage: 61000,
    colour: "White",
    new_used: "Used",
    condition: "Excellent",
    extras: "Tow bar, Canopy",
    description: "One owner.",
    reference_id: 12,
    vin: "AHTKB3CD",
    mm_code: 60013500,
    date_updated: "2026-09-01T08:00:00.000Z",
    images: ["https://s3/a.jpg", "https://s3/b.jpg"],
    status: "available",
    featured: true,
    ...overrides,
  };
}

test("identical floor reports no changes", () => {
  const d = diffStock([car()], [car()]);
  assert.deepEqual(d, { added: [], changed: [], removed: [], total: 0 });
});

test("a price change on one car is one changed slug", () => {
  const d = diffStock([car()], [car({ price: 529995 })]);
  assert.deepEqual(d.changed, ["stock-820"]);
  assert.equal(d.total, 1);
});

test("a car in the feed but not on the site is added", () => {
  const d = diffStock([car()], [car(), car({ slug: "stock-999", stock_id: 999 })]);
  assert.deepEqual(d.added, ["stock-999"]);
  assert.deepEqual(d.changed, []);
  assert.equal(d.total, 1);
});

test("a car on the site but no longer in the feed is removed", () => {
  const d = diffStock([car(), car({ slug: "stock-999", stock_id: 999 })], [car()]);
  assert.deepEqual(d.removed, ["stock-999"]);
  assert.equal(d.total, 1);
});

test("a sold car coming back into the feed is a change", () => {
  const d = diffStock([car({ status: "sold" })], [car({ status: "available" })]);
  assert.deepEqual(d.changed, ["stock-820"]);
});

test("a reordered photo set is a change", () => {
  const d = diffStock([car()], [car({ images: ["https://s3/b.jpg", "https://s3/a.jpg"] })]);
  assert.deepEqual(d.changed, ["stock-820"]);
});

test("bookkeeping columns never count as a change", () => {
  const existing = { ...car(), synced_at: "2026-09-01T00:00:00Z", id: "x", created_at: "2026-01-01", source: "feed" };
  const incoming = { ...car(), synced_at: "2026-09-09T00:00:00Z" };
  const d = diffStock([existing], [incoming]);
  assert.equal(d.total, 0);
});

test("null and undefined mean the same absent value", () => {
  const d = diffStock([car({ vin: null })], [car({ vin: undefined })]);
  assert.equal(d.total, 0);
});
