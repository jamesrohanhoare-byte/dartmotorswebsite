import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinSoldGrace, SOLD_GRACE_DAYS } from "./soldGrace.ts";

// Run: npm test  (Node 24 strips the types itself, no runner to install)

const NOW = Date.parse("2026-09-25T12:00:00.000Z");
const days = (n: number) => n * 86_400_000;

test("a car that left the floor today is still servable", () => {
  assert.equal(isWithinSoldGrace({ synced_at: "2026-09-25T10:38:28.242+00:00" }, NOW), true);
});

test("a car one day inside the window is still servable", () => {
  const at = new Date(NOW - days(SOLD_GRACE_DAYS - 1)).toISOString();
  assert.equal(isWithinSoldGrace({ synced_at: at }, NOW), true);
});

test("a car one day past the window is not", () => {
  const at = new Date(NOW - days(SOLD_GRACE_DAYS + 1)).toISOString();
  assert.equal(isWithinSoldGrace({ synced_at: at }, NOW), false);
});

// PostgREST hands timestamptz back as "+00:00" while the sync writes ".000Z".
// The same moment spelled two ways once flagged all 31 cars as changed, so the
// comparison here is on instants, never on strings.
test("the two spellings of the same instant agree", () => {
  const postgrest = "2026-09-17T10:30:43.595+00:00";
  const js = "2026-09-17T10:30:43.595Z";
  assert.equal(isWithinSoldGrace({ synced_at: postgrest }, NOW), isWithinSoldGrace({ synced_at: js }, NOW));
});

// A row with no synced_at must be treated as long gone. If absence read as
// "fresh", every legacy row would become permanently servable and the grace
// window would quietly mean nothing.
test("a row with no synced_at is not servable", () => {
  assert.equal(isWithinSoldGrace({ synced_at: null }, NOW), false);
  assert.equal(isWithinSoldGrace({ synced_at: undefined as unknown as null }, NOW), false);
});

test("an unparseable synced_at is not servable", () => {
  assert.equal(isWithinSoldGrace({ synced_at: "not a date" }, NOW), false);
});

// The window is the SAME number on both sides of the system. If this ever needs
// changing it changes here, and the feed and the website move together.
test("the grace window is the one the Meta feed advertises against", () => {
  assert.equal(SOLD_GRACE_DAYS, 90);
});
