import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { fetchVehicles, fullPhotoFeedUrl, parseVehicles, versionImageUrl } from "./fetchFeed.ts";

// Run: npm test

const S3 = "https://s3-eu-west-1.amazonaws.com/vmg.images.production/1032/1032_1102";

// The f1 format, as VMG served it for dealer 1032 on 2026-10-23: lowercase
// <colour>/<description>, a <Registration> tag, and up to 20 photos.
function f1(photoCount: number): string {
  const imgs = Array.from({ length: photoCount }, (_, i) => `<imgurl>${S3}_I${i + 1}.jpg</imgurl>`).join("");
  return `<?xml version="1.0" standalone="yes"?>
<stock><dealer><dealername>Dart Motors</dealername><dealerID>1032</dealerID>
<vehicle>
  <stockID>1102</stockID>
  <DateUpdated>2026-10-23 12:49:27</DateUpdated>
  <newUsed>Used</newUsed>
  <Make>TOYOTA</Make>
  <variant>HILUX 3.0 D-4D RAIDER</variant>
  <price>289995.0000</price>
  <mmCode>60045660</mmCode>
  <mileage>201000</mileage>
  <year>2013</year>
  <colour>White</colour>
  <extras>Towbar</extras>
  <condition>Excellent</condition>
  <description>Snorkel fitted.</description>
  <referenceID>900</referenceID>
  <VIN>AHTFR22G000000000</VIN>
  <Registration>CA123456</Registration>
  <images>${imgs}</images>
</vehicle></dealer></stock>`;
}

test("f1 feed: every photo is kept, not just the first 10", () => {
  const [car] = parseVehicles(f1(20));
  assert.equal(car.images.length, 20);
  assert.match(car.images[19], /_I20\.jpg/);
});

test("f1 feed: lowercase colour and description are read", () => {
  const [car] = parseVehicles(f1(3));
  assert.equal(car.colour, "White");
  assert.equal(car.description, "Snorkel fitted.");
});

test("f15 feed: capitalised Colour and Description still read", () => {
  const xml = f1(3).replace("<colour>White</colour>", "<Colour>Silver</Colour>")
    .replace("<description>Snorkel fitted.</description>", "<Description>One owner.</Description>");
  const [car] = parseVehicles(xml);
  assert.equal(car.colour, "Silver");
  assert.equal(car.description, "One owner.");
});

test("the registration number is never carried through", () => {
  const [car] = parseVehicles(f1(3));
  assert.doesNotMatch(JSON.stringify(car), /CA123456/);
});

test("photos carry the car's last-edited time, so a swapped photo gets a new link", () => {
  const [car] = parseVehicles(f1(2));
  assert.equal(car.images[0], `${S3}_I1.jpg?v=20261023124927`);
});

test("an edit in VMG changes every photo link on that car", () => {
  const before = versionImageUrl(`${S3}_I1.jpg`, "2026-10-23 09:17:41");
  const after = versionImageUrl(`${S3}_I1.jpg`, "2026-10-23 12:49:27");
  assert.notEqual(before, after);
});

test("no edit time leaves the link untouched", () => {
  assert.equal(versionImageUrl(`${S3}_I1.jpg`, ""), `${S3}_I1.jpg`);
});

test("a link that already has a query string gets & not a second ?", () => {
  assert.equal(versionImageUrl("https://x/a.jpg?w=1", "2026-10-23 12:49:27"), "https://x/a.jpg?w=1&v=20261023124927");
});

// VMG switches the f1 format on per dealer: Dart (1032) has it, Riverside (21)
// returned 404 on 2026-10-23. A dealer configured on f15 must upgrade itself
// the day VMG enables f1, and must keep syncing on f15 until then.
const F15 = "http://feeds.vmgsoftware.co.za/xml/f15/feed_21.xml";
const F1 = "http://feeds.vmgsoftware.co.za/xml/f1/feed_21.xml";

function serve(routes: Record<string, { status: number; body: string }>) {
  return mock.method(globalThis, "fetch", async (url: string) => {
    const r = routes[url] ?? { status: 404, body: "" };
    return new Response(r.body, { status: r.status });
  });
}

test("an f15 address maps to its f1 twin; anything else is left alone", () => {
  assert.equal(fullPhotoFeedUrl(F15), F1);
  assert.equal(fullPhotoFeedUrl(F1), F1);
});

test("configured on f15, f1 available: reads f1 and gets every photo", async (t) => {
  process.env.VMG_FEED_URL = F15;
  const fetchMock = serve({ [F1]: { status: 200, body: f1(20) }, [F15]: { status: 200, body: f1(10) } });
  t.after(() => fetchMock.mock.restore());
  const { vehicles, photoFeed } = await fetchVehicles();
  assert.equal(vehicles[0].images.length, 20);
  assert.equal(photoFeed, "f1");
});

test("configured on f15, f1 not enabled: keeps syncing on f15 and says so", async (t) => {
  process.env.VMG_FEED_URL = F15;
  const fetchMock = serve({ [F15]: { status: 200, body: f1(10) } });
  t.after(() => fetchMock.mock.restore());
  const { vehicles, photoFeed } = await fetchVehicles();
  assert.equal(vehicles.length, 1);
  assert.match(photoFeed, /f15.*10 photos.*VMG/);
});

test("configured on f1: one request, no fallback", async (t) => {
  process.env.VMG_FEED_URL = F1;
  const fetchMock = serve({ [F1]: { status: 200, body: f1(20) } });
  t.after(() => fetchMock.mock.restore());
  const { photoFeed } = await fetchVehicles();
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(photoFeed, "f1");
});
