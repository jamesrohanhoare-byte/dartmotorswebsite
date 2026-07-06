import { revalidatePath } from "next/cache";
import { syncStock } from "@/lib/feed/sync";

// VMG feed → site_stock sync. Replaces the old Framer publish step entirely:
// after a successful sync we revalidate the ISR pages so changes go live.
//   • Vercel cron calls GET with the `x-vercel-cron: 1` header (no secret needed)
//   • Manual / GitHub Action calls POST with `Authorization: Bearer <SYNC_SECRET>`

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
    const result = await syncStock();
    // Refresh every ISR page (all share the root layout) so new/updated/sold
    // stock appears immediately instead of waiting for the revalidate window.
    revalidatePath("/", "layout");
    return Response.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[sync] failed:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
