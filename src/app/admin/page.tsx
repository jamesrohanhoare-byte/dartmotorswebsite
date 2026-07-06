import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { SiteStock } from "@/lib/types";
import AdminLogin from "@/components/site/AdminLogin";
import FeatureManager from "@/components/site/FeatureManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin · Dart Motors",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("site_stock")
    .select("*")
    .eq("status", "available")
    .order("featured", { ascending: false })
    .order("price", { ascending: false, nullsFirst: false });

  return <FeatureManager cars={(data ?? []) as SiteStock[]} />;
}
