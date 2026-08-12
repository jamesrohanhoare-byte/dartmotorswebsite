import { revalidatePath } from "next/cache";

// Manual listings (created in Dartbooks) publish through here.
//
// ISR holds pages for an hour, which is too slow for "I just added it, where is it".
// /api/sync solves the same problem by calling revalidatePath after it writes; this
// is that hook exposed so the database can call it too. A trigger on site_stock fires
// pg_net at this route whenever a manual row is inserted, updated or deleted
// (migration 00050), so the secret lives in Postgres and never in a browser bundle.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  // SYNC_SECRET is accepted as well so a manual curl works with the same credential
  // the sync uses. An unset secret must never authorize anything.
  const secrets = [process.env.REVALIDATE_SECRET, process.env.SYNC_SECRET].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  return secrets.includes(token);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Every public page shares the root layout, so one call refreshes the shop grid,
  // the homepage and the listing itself — the same blanket the sync uses.
  revalidatePath("/", "layout");
  return Response.json({ revalidated: true, timestamp: new Date().toISOString() });
}
