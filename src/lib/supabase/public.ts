import { createClient } from "@supabase/supabase-js";

// Cookie-free client for PUBLIC reads (inventory, vehicle pages, sitemap).
// No session needed — RLS grants anonymous read of available stock — so pages
// can be statically rendered for SEO without forcing dynamic (cookie) rendering.
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);
