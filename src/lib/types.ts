// Domain types — mirror the website tables (supabase/migrations/00044_site_tables.sql).
// Stock is synced from the VMG feed; images are hotlinked VMG S3 URLs (never re-hosted).

export type StockStatus = "available" | "sold";

/** Where a row came from. `manual` rows are created in Dartbooks and the feed sync
 *  must never reconcile them (migration 00050 / docs/manual-listings-design.md). */
export type StockSource = "feed" | "manual";

/** One labelled spec row on a manual listing, e.g. { label: "Total length", value: "6.2 m" }. */
export interface StockSpec {
  label: string;
  value: string;
}

/** One vehicle from the VMG feed, as stored in `site_stock`. */
export interface SiteStock {
  id: string;
  slug: string; // "stock-{stock_id}" — stable key, also the /shop URL
  stock_id: number;
  make: string;
  variant: string | null;
  title: string | null; // "{year} {make} {variant}"
  year: number | null;
  price: number | null; // whole rand; null/0 => POA
  mileage: number | null;
  colour: string | null;
  new_used: string | null;
  condition: string | null;
  extras: string | null; // raw feature blob (comma/pipe/newline separated)
  description: string | null;
  reference_id: number | null;
  date_updated: string | null;
  images: string[]; // ordered VMG S3 URLs
  status: StockStatus;
  featured: boolean;
  synced_at: string;
  created_at: string;
  source: StockSource;
  /** Manual listings only: replaces the car spec grid (a trailer has no mileage). */
  specs: StockSpec[] | null;
  /** Whether the "Apply for financing" CTA renders. Off for a trailer. */
  show_finance: boolean;
}

export type LeadChannel = "form" | "whatsapp" | "email" | "newsletter";

/** A website enquiry written to `site_leads`. */
export interface LeadInsert {
  stock_slug?: string | null;
  name?: string | null;
  contact?: string | null;
  channel: LeadChannel;
  message?: string | null;
  meta?: Record<string, unknown> | null;
}
