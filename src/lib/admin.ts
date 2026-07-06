import { cookies } from "next/headers";

// Simple shared-password gate for the /admin featured-car manager. The password
// lives in ADMIN_PASSWORD (server env, no NEXT_PUBLIC_ prefix). On login we set
// an httpOnly cookie holding the password; every admin action re-checks it.
// Low-stakes surface (toggling a boolean), so a single shared password is fine.
export const ADMIN_COOKIE = "dart_admin";

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

export async function isAdmin(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === pw;
}
