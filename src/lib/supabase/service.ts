import { createClient } from "@supabase/supabase-js";

// ── SERVER-ONLY service-role client ──────────────────────────────────────────
// Bypasses RLS — used ONLY by /api/sync to write site_stock (the one code path
// that needs privileged writes). NEVER import this into a client component: the
// key is read from SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix), so Next
// never ships it to the browser bundle. Keep its use limited to the site_ tables.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}
