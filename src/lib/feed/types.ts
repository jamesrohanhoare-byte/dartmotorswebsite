// A vehicle as parsed from the VMG XML feed (feeds.vmgsoftware.co.za).
//
// ⚠️ `site_stock` is ANON-READABLE (RLS grants anon SELECT), so anything stored
// here is publicly readable via the anon key. That is why VIN, M&M code and
// licence number were originally left out.
//
// Revised 2026-08-17: VIN and mmCode ARE now carried through.
//  - `vin` is required by Meta's vehicle catalog and we publish it in the public
//    feed at /api/feed/meta regardless, so storing it anon-readable exposes
//    nothing that is not already public by design. A VIN is also printed on the
//    windscreen and listed on every portal — it is not personal data.
//  - `mmCode` is the canonical SA make/model/variant identifier, the join key for
//    any future pricing or demand-intelligence work. Not sensitive.
//  - `licenceNumber` REMAINS deliberately excluded. A registration number is
//    personal data about the current/previous owner and must never be published.
//    Do not add it, even though VMG publishes it.
export interface FeedVehicle {
  stockID: number;
  dateUpdated: string; // "2026-01-31 12:23:36"
  newUsed: string;
  make: string;
  variant: string;
  price: number;
  mileage: number;
  year: number;
  colour: string;
  extras: string;
  condition: string;
  description: string;
  referenceID: number;
  vin: string; // e.g. "WV1ZZZ2HZDH013110" — Meta catalog field
  mmCode: number; // e.g. 64072445 — SA Mead & McGrouther code
  images: string[]; // ordered S3 URLs
}
