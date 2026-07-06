"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { SiteStock } from "@/lib/types";
import { formatPrice, stockTitle } from "@/lib/format";

export default function FeatureManager({ cars }: { cars: SiteStock[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(cars.map((c) => [c.slug, c.featured])),
  );
  const [saving, setSaving] = useState<string | null>(null);

  const featuredCount = Object.values(state).filter(Boolean).length;

  async function toggle(slug: string) {
    const next = !state[slug];
    setState((s) => ({ ...s, [slug]: next })); // optimistic
    setSaving(slug);
    const res = await fetch("/api/admin/feature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, featured: next }),
    });
    if (!res.ok) setState((s) => ({ ...s, [slug]: !next })); // revert on failure
    setSaving(null);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="px-page mx-auto max-w-[1100px] py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Featured cars</h1>
          <p className="mt-1 text-sm text-muted">
            Tap the star to feature a car. Featured cars show first on the homepage.
            <span className="ml-1 font-semibold text-foreground">{featuredCount} featured.</span>
          </p>
        </div>
        <button onClick={logout} className="rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-2">
          Log out
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((c) => {
          const on = state[c.slug];
          const lead = c.images?.[0];
          return (
            <div
              key={c.slug}
              className={`flex items-center gap-3 rounded-2xl border bg-surface p-3 transition-colors ${on ? "border-accent" : "border-border"}`}
            >
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {lead ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lead} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{stockTitle(c)}</div>
                <div className="text-xs text-muted">{formatPrice(c.price)}</div>
              </div>
              <button
                onClick={() => toggle(c.slug)}
                disabled={saving === c.slug}
                aria-label={on ? "Unfeature" : "Feature"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${on ? "text-accent" : "text-muted hover:text-foreground"} disabled:opacity-40`}
              >
                <Star size={22} className={on ? "fill-current" : ""} />
              </button>
            </div>
          );
        })}
      </div>

      {cars.length === 0 && (
        <p className="mt-10 text-sm text-muted">No available stock to feature yet.</p>
      )}
    </div>
  );
}
