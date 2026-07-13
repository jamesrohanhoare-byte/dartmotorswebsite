import { createServiceClient } from "@/lib/supabase/service";

// AutoTrader Leads Service (v2) → site_leads.
//
// PULL API (not push): we poll the `received=false` streams, ingest each lead into
// site_leads (channel 'autotrader', deduped by external_id), then acknowledge via
// set-received so a lead is never handed back once we hold it.
//
// One Social Agencies credential (AUTOTRADER_API_TOKEN = the ready-made Basic auth
// blob); the dealer is chosen by AUTOTRADER_DEALER_ID (Dart = 31613). To onboard a
// new dealer: AutoTrader links them to our account + gives their DID → set that DID.
//
// Docs / tester: services.autotrader.co.za/index.html → "Leads Service v2".

const BASE = "https://services.autotrader.co.za";
const API = "/api/lead/v2.0";

export interface AutoTraderSyncResult {
  fetched: number; // leads pulled from both streams
  stored: number; // rows now guaranteed in site_leads (new + already present)
  acknowledged: number; // leads marked received on AutoTrader
}

// The rich contact-form stream (GET /leads → sendContactMessageLeads).
type ContactLead = {
  id: number;
  listingId?: number;
  stockNumber?: string;
  name?: string;
  phoneNumber?: string;
  emailAddress?: string;
  message?: string;
  date?: string;
  newUsed?: string;
  make?: string;
  model?: string;
  variant?: string;
  mileage?: number;
  registrationYear?: number;
  price?: number;
  registrationNumber?: string;
  preQualifiedStatus?: string;
  isVerifiedEmail?: boolean;
  source?: string; // ContactFormMessage | WhatsApp
};

// The dealer-level / WhatsApp-click stream (GET /leads/dealers → dealerLeads).
type DealerLead = {
  id: number;
  dealerName?: string;
  name?: string;
  phoneNumber?: string;
  emailAddress?: string;
  message?: string;
  date?: string;
  source?: string;
  whatsAppLinkGenerated?: boolean;
};

type LeadRow = {
  external_id: string;
  stock_slug: string | null;
  name: string | null;
  contact: string | null;
  channel: "autotrader";
  message: string | null;
  meta: Record<string, unknown>;
  created_at: string | null;
};

function authHeaders(): Record<string, string> {
  const token = process.env.AUTOTRADER_API_TOKEN;
  if (!token) throw new Error("AUTOTRADER_API_TOKEN not configured");
  return { Authorization: `Basic ${token}`, Accept: "application/json" };
}

function carLabel(l: { registrationYear?: number; make?: string; model?: string; variant?: string }): string {
  return [l.registrationYear || null, l.make, l.model, l.variant].filter(Boolean).join(" ");
}

function isoDate(d?: string): string | null {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`AutoTrader GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// Acknowledge leads. ids go as REPEATED query params (?ids=1&ids=2&received=true),
// NOT a JSON body (a body returns 400 "ids required"). Best-effort: never throws —
// the leads are already saved + deduped, so a missed ack just re-fetches harmlessly.
// A few AutoTrader dealer ids reliably 500 (stale duplicate records), and one bad
// id poisons its whole batch, so on a batch failure we retry it id-by-id to
// acknowledge the good ones and skip only the broken.
async function ackBatch(path: string, ids: number[]): Promise<boolean> {
  if (!ids.length) return true;
  const qs = ids.map((id) => `ids=${id}`).join("&") + "&received=true";
  try {
    const res = await fetch(`${BASE}${path}?${qs}`, { method: "POST", headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

async function postReceived(path: string, ids: number[]): Promise<number> {
  let done = 0;
  const CHUNK = 20;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    if (await ackBatch(path, batch)) {
      done += batch.length;
      continue;
    }
    // Batch rejected (a poison id inside) — acknowledge id-by-id, skip the bad ones.
    for (const id of batch) {
      if (await ackBatch(path, [id])) done += 1;
    }
  }
  return done;
}

/**
 * Pull both AutoTrader lead streams for the configured dealer, ingest into
 * site_leads (deduped), then acknowledge. Safe to run repeatedly: external_id
 * makes inserts idempotent, and acknowledgement only runs after a clean upsert.
 *
 * @param opts.acknowledge  set false to ingest WITHOUT marking leads received
 *                          (used for the first verification run so leads stay
 *                          re-pullable while we confirm the mapping looks right).
 */
export async function syncAutoTraderLeads(opts: { acknowledge?: boolean } = {}): Promise<AutoTraderSyncResult> {
  const acknowledge = opts.acknowledge ?? true;
  const did = process.env.AUTOTRADER_DEALER_ID;
  if (!did) throw new Error("AUTOTRADER_DEALER_ID not configured");

  const supabase = createServiceClient();

  // Best-effort: link a lead to the exact on-site car when the AutoTrader stock
  // number matches a site_stock row. Only links on an exact stock_id match, so a
  // mismatch just leaves stock_slug null (the car still shows via meta.car).
  const { data: stock } = await supabase.from("site_stock").select("slug, stock_id");
  const slugByStockId = new Map<number, string>();
  for (const s of stock ?? []) {
    if (s.stock_id != null) slugByStockId.set(Number(s.stock_id), s.slug as string);
  }
  const slugFor = (stockNumber?: string): string | null => {
    const n = Number(stockNumber);
    return Number.isFinite(n) && slugByStockId.has(n) ? slugByStockId.get(n)! : null;
  };

  // 1. Fetch both unreceived streams for this dealer.
  const contact = await getJson<{ sendContactMessageLeads?: ContactLead[] }>(
    `${API}/leads?dealerIds=${did}&received=false`,
  );
  const dealer = await getJson<{ dealerLeads?: DealerLead[] }>(
    `${API}/leads/dealers?dealerIds=${did}&received=false`,
  );
  const contactLeads = contact.sendContactMessageLeads ?? [];
  const dealerLeads = dealer.dealerLeads ?? [];

  // 2. Map → site_leads rows.
  const rows: LeadRow[] = [];

  for (const l of contactLeads) {
    const car = carLabel(l);
    rows.push({
      external_id: `at:${l.id}`,
      stock_slug: slugFor(l.stockNumber),
      name: l.name?.slice(0, 200) ?? null,
      contact: (l.emailAddress || l.phoneNumber || "").slice(0, 200) || null,
      channel: "autotrader",
      message: (l.message?.trim() || (car ? `Enquiry on ${car}` : "AutoTrader enquiry")).slice(0, 4000),
      meta: {
        source: "AutoTrader",
        atSource: l.source ?? null,
        phone: l.phoneNumber ?? null,
        car: car || null,
        price: l.price ?? null,
        stockNumber: l.stockNumber ?? null,
        registrationNumber: l.registrationNumber ?? null,
        mileage: l.mileage ?? null,
        newUsed: l.newUsed ?? null,
        preQualified: l.preQualifiedStatus ?? null,
        verifiedEmail: l.isVerifiedEmail ?? null,
        listingId: l.listingId ?? null,
      },
      created_at: isoDate(l.date),
    });
  }

  // The dealer/WhatsApp stream is noisy: one person can fire many "clicked
  // WhatsApp" events (repeat clicks). Collapse to one lead per phone (keeping the
  // most recent), so a repeat-clicker isn't logged 3x. external_id keys on the
  // phone, so future polls don't re-add them either. No-phone events fall back to
  // their event id.
  const byPhone = new Map<string, DealerLead>();
  for (const l of dealerLeads) {
    const digits = (l.phoneNumber || "").replace(/\D/g, "");
    const key = digits || `id:${l.id}`;
    const prev = byPhone.get(key);
    if (!prev || new Date(l.date ?? 0) > new Date(prev.date ?? 0)) byPhone.set(key, l);
  }
  for (const [key, l] of byPhone) {
    rows.push({
      external_id: `atd:${key}`,
      stock_slug: null,
      name: l.name?.slice(0, 200) ?? null,
      contact: (l.emailAddress || l.phoneNumber || "").slice(0, 200) || null,
      channel: "autotrader",
      message: (l.message?.trim() || "WhatsApp enquiry via AutoTrader").slice(0, 4000),
      meta: {
        source: "AutoTrader",
        atSource: l.source ?? "WhatsApp",
        phone: l.phoneNumber ?? null,
        whatsApp: l.whatsAppLinkGenerated ?? null,
        dealerName: l.dealerName ?? null,
      },
      created_at: isoDate(l.date),
    });
  }

  // 3. Insert, skipping any external_id we already hold (dedupe). A clean upsert
  //    guarantees every fetched lead is present before we acknowledge any of them.
  if (rows.length > 0) {
    const { error } = await supabase
      .from("site_leads")
      .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });
    if (error) throw new Error(`site_leads upsert failed: ${error.message}`);
  }

  // 4. Acknowledge (set-received) — only after a clean upsert, so a lead is never
  //    marked received until it is safely in our DB. Idempotent w.r.t. re-pulls.
  let acknowledged = 0;
  if (acknowledge) {
    acknowledged += await postReceived(`${API}/leads/set-received`, contactLeads.map((l) => l.id));
    acknowledged += await postReceived(`${API}/leads/dealers/received`, dealerLeads.map((l) => l.id));
  }

  // 5. Heartbeat for the "last synced X ago" stamp on the Sales & Leads page.
  await supabase.from("site_sync_state").upsert(
    {
      key: "autotrader_leads",
      last_run_at: new Date().toISOString(),
      ok: true,
      note: `fetched ${rows.length}, acknowledged ${acknowledged}`,
    },
    { onConflict: "key" },
  );

  return { fetched: rows.length, stored: rows.length, acknowledged };
}
