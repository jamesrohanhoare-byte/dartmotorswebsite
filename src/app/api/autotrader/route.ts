import { syncAutoTraderLeads } from "@/lib/autotrader/poll";

// AutoTrader Leads Service (v2) → site_leads poller.
//
// Scheduled by a Supabase pg_cron job (`autotrader-leads-sync`, */5 * * * *) that
// POSTs this route every 5 min with `Authorization: Bearer <AUTOTRADER_SYNC_SECRET>`.
// pg_cron fires frequent intervals reliably; GitHub Actions silently drops them, so
// the old autotrader.yml Action was removed. Ingest is deduped by external_id, so
// overlapping runs are harmless.
//
// Auth accepts any of: the `x-vercel-cron: 1` header, the dedicated
// AUTOTRADER_SYNC_SECRET (pg_cron), or the shared SYNC_SECRET (manual / backup call).

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return false;
  // Accept the shared SYNC_SECRET (GitHub Actions) OR a dedicated AUTOTRADER_SYNC_SECRET
  // (used by the Supabase pg_cron poller, so it never touches the stock-sync secret).
  const secrets = [process.env.SYNC_SECRET, process.env.AUTOTRADER_SYNC_SECRET].filter(Boolean);
  return secrets.includes(token);
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncAutoTraderLeads();
    return Response.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[autotrader] failed:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
