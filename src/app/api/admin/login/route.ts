import { cookies } from "next/headers";
import { adminPassword, ADMIN_COOKIE } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { password } → set the admin cookie. DELETE → log out.
export async function POST(req: Request) {
  const pw = adminPassword();
  if (!pw) return Response.json({ error: "Admin not configured (set ADMIN_PASSWORD)" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (body.password !== pw) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, pw, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return Response.json({ success: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ success: true });
}
