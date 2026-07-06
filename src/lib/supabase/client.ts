import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client (Client Components). Uses the public anon key —
// safe to expose; all access is gated by Row Level Security.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
