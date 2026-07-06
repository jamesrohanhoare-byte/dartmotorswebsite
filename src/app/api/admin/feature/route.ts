import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { slug, featured } → toggle a car's featured flag, then revalidate the
// homepage so the change shows immediately. Admin-cookie protected.
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { slug?: string; featured?: boolean };
  if (typeof body.slug !== "string" || typeof body.featured !== "boolean") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("site_stock")
    .update({ featured: body.featured })
    .eq("slug", body.slug);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  revalidatePath("/", "layout");
  return Response.json({ success: true });
}
