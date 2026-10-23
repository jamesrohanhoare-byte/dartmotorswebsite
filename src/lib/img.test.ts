import { test } from "node:test";
import assert from "node:assert/strict";
import { cdnImg } from "./img.ts";

// Run: npm test

const VMG = "https://s3-eu-west-1.amazonaws.com/vmg.images.production/1032/1032_1092_I3.jpg?v=20261020151302";

// Found 2026-10-23: VMG stored Dart's photos as 500px PNGs named .jpg. weserv kept
// PNG and blew each one up to 1400px, so one gallery photo was 2.4 MB and a
// 20-photo car page ~50 MB. JPEG, never enlarged: 34 KB for the same photo.
test("always asks for a JPEG, whatever VMG stored", () => {
  assert.match(cdnImg(VMG, 1400, 82), /&output=jpg/);
});

test("never enlarges a photo past its own size", () => {
  assert.match(cdnImg(VMG, 1400, 82), /&we(&|$)/);
});

test("the photo's version tag stays part of the source address", () => {
  assert.match(cdnImg(VMG, 640), /1032_1092_I3\.jpg\?v=20261020151302&w=640/);
});

test("local assets pass through untouched", () => {
  assert.equal(cdnImg("/dart-logo.png", 200), "/dart-logo.png");
});
