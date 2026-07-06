// A vehicle as parsed from the VMG XML feed (feeds.vmgsoftware.co.za).
// VIN / M&M code / licence are deliberately NOT carried through — the website
// never displays them, so they are not stored in the anon-readable site_stock.
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
  images: string[]; // ordered S3 URLs
}
