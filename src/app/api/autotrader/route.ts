import { syncAutoTraderLeads } from "@/lib/autotrader/poll";

// AutoTrader Leads Service (v2) → site_leads poller. Auth mirrors /api/sync exactly:
//   • Vercel cron calls GET with the `x-vercel-cron: 1` header (no secret needed)
//   • GitHub Action / manual calls POST with `Authorization: Bearer <SYNC_SECRET>`
//
// Runs every ~15 min (see .github/workflows/autotrader.yml). Ingest is deduped, so
// overlapping runs are harmless.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  const secret = process.env.SYNC_SECRET ?? "";
  return secret.length > 0 && token === secret;
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
