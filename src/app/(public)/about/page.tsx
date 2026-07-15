import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { dealer } from "@/config/dealer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Dart Motors | Trusted Since 1975",
  description: `${dealer.name} has sold quality used cars in Cape Town since 1975. Built on honesty and integrity, with vehicle financing. Read our story.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="px-page mx-auto max-w-[1100px] py-14 md:py-20">
      <header className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-3 text-accent">Our story</p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">Cape Town&apos;s used-car family since 1975.</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Errol opened Dart Motors on Sir Lowry Road in 1975 with a simple promise:
            sell honest cars to honest people. Fifty years and two generations later,
            that hasn&apos;t changed. We&apos;re still family-run, still here to sort your finance,
            and still shake on every deal.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vintage/vintage-street.jpg" alt="Dart Motors' Cape Town neighbourhood in the late 1970s" className="aspect-[4/3] w-full object-cover" />
        </div>
      </header>

      {/* Stats */}
      <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {dealer.stats.map((s) => (
          <div key={s.label} className="bg-surface p-6 text-center">
            <div className="text-2xl font-bold text-accent md:text-3xl">{s.value}</div>
            <div className="mt-1 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heritage */}
      <section className="mt-14 grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">Our story</h2>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted">
            {dealer.heritage.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vintage/vintage-sign.jpg"
            alt="The original Dart Motors used cars sign, Cape Town, late 1970s"
            className="aspect-[4/3] w-full object-cover"
          />
          <p className="px-4 py-3 text-xs italic text-muted">The original Dart Motors lot, Cape Town — late 1970s</p>
        </div>
      </section>

      {/* Team */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold md:text-3xl">The team</h2>
        <p className="mt-2 text-sm text-muted">The people who&apos;ll actually pick up the phone.</p>
        {/* Leadership on top (2), then the rest 3-per-row */}
        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-4">
          {dealer.team.slice(0, 2).map((t) => (
            <div key={t.name} className="overflow-hidden rounded-2xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.photo} alt={t.name} className="aspect-[4/5] w-full object-cover object-top" />
              <div className="p-4">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-accent">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {dealer.team.slice(2).map((t) => (
            <div key={t.name} className="overflow-hidden rounded-2xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.photo} alt={t.name} className="aspect-[4/5] w-full object-cover object-top" />
              <div className="p-4">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-accent">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-14 flex flex-wrap gap-4">
        <Link href="/shop" className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold">
          Browse our stock <ArrowRight size={16} />
        </Link>
        <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 text-sm font-medium transition-colors hover:bg-surface-2">
          Contact us
        </Link>
      </div>
    </div>
  );
}
