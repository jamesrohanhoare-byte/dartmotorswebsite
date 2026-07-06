import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the on-screen Next.js dev tools indicator (the "N" badge) — dev-only UI.
  devIndicators: false,

  // ── BANDWIDTH GUARANTEE (the whole reason we left Framer) ──────────────────
  // Car photos are hotlinked straight from VMG's public S3 via a plain <img>,
  // never re-hosted. `unoptimized` ensures that even an accidental next/image
  // usage never proxies an image through Vercel's optimizer — so there is no
  // bandwidth meter on us to blow, ever (Framer hit a 50GB wall re-hosting them).
  images: { unoptimized: true },

  // Legacy Framer paths → new routes (SEO parity). The core /shop/stock-{id}
  // scheme is kept identical, so most indexed URLs need no redirect.
  async redirects() {
    return [];
  },
};

export default nextConfig;
