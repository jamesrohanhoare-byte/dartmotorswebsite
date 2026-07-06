import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Banknote, Clock, Award, ChevronDown } from "lucide-react";
import { getFeaturedStock } from "@/lib/queries";
import { dealer, whatsappLink } from "@/config/dealer";
import VehicleCard from "@/components/site/VehicleCard";
import ScrollRow from "@/components/site/ScrollRow";
import Reveal from "@/components/site/Reveal";
import VintageCarousel from "@/components/site/VintageCarousel";
import Reviews from "@/components/site/Reviews";
import DealerSchema from "@/components/site/DealerSchema";
import Newsletter from "@/components/site/Newsletter";
import SourcePopup from "@/components/site/SourcePopup";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const VALUES = [
  { icon: Clock, title: "Trusted Since 1975", body: "Fifty years selling quality used cars, built on honesty and integrity." },
  { icon: Banknote, title: "In-House Finance", body: "No banks, no hassle. We finance in-house so more people get approved." },
  { icon: ShieldCheck, title: "Quality, Inspected", body: "Every vehicle is checked and roadworthy before it reaches the floor." },
  { icon: Award, title: "50 Years, One Family", body: "Founded in 1975 and still family-run, trading on the same handshake." },
];

const FAQS = [
  {
    q: "Does Dart Motors offer in-house finance?",
    a: "Yes. We finance in-house, so there are no banks to deal with and more buyers get approved. As a registered credit provider we handle the whole process under one roof, and you can apply online in a few minutes.",
  },
  {
    q: "Where is Dart Motors based?",
    a: "We're at 130 Sir Lowry Road, Woodstock, Cape Town. You're welcome to visit the showroom during trading hours, Monday to Saturday.",
  },
  {
    q: "How long has Dart Motors been trading?",
    a: "Since 1975 — fifty years selling quality used cars in Cape Town, still family-run and trading on the same honesty and integrity it started on.",
  },
  {
    q: "Are your cars checked and roadworthy?",
    a: "Every vehicle is inspected and roadworthy before it reaches the floor, and we offer warranty and insurance options so you can drive away covered.",
  },
  {
    q: "What kind of cars do you sell?",
    a: "A wide range of quality pre-owned cars and bakkies from popular brands like Toyota, Volkswagen, Ford, Hyundai, Kia and Isuzu, with new stock arriving regularly.",
  },
  {
    q: "Can I apply for finance online?",
    a: "Yes. Head to our financing page and complete a quick application — it takes just a few minutes and we'll come straight back to you.",
  },
];

export default async function HomePage() {
  const featured = await getFeaturedStock(6);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <DealerSchema />

      {/* ── Hero (single vintage heritage photo) ──────────────── */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-neutral-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vintage/vintage-lot.jpg" alt="Dart Motors, Cape Town — trading since 1975" className="hero-zoom absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/80" />
        <div className="px-page relative mx-auto w-full max-w-3xl pt-24 pb-14 text-center">
          <Reveal>
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold">Dart · Since 1975</span>
            <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-[1.05] md:text-6xl lg:text-7xl">{dealer.tagline}</h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{dealer.heroSub}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/shop" className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold sm:w-auto">
                Buy a Car <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/20 sm:w-auto">
                Contact us
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Values strip ─────────────────────────────────────── */}
      <section className="px-page mx-auto max-w-[1400px] py-14 md:py-16">
        <div className="grid grid-cols-2 gap-y-8 gap-x-6 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.08}>
              <v.icon size={22} className="text-accent" />
              <h3 className="mt-4 text-sm font-bold">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Cinematic video band (Hilux) ─────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="relative flex min-h-[52vh] items-center justify-center md:min-h-[64vh]">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/hilux-web.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/45" />
          <div className="px-page relative mx-auto w-full max-w-[1400px] py-16 text-center text-white">
            <Reveal>
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">Dart · Since 1970s</span>
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">Quality Pre-Owned. Ready to Ride.</h2>
              <p className="mx-auto mt-4 max-w-xl text-white/85">Carefully checked, road-ready cars and bakkies, giving you performance and reliability without the new price tag.</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/shop" className="btn-primary rounded-full px-6 py-3 text-sm font-semibold">Buy a Car</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Featured Vehicles ────────────────────────────────── */}
      <section className="bg-surface-2/50 py-14 md:py-20">
        <div className="px-page mx-auto max-w-[1400px]">
          <Reveal>
            <div className="mb-8 flex items-end justify-between">
              <h2 className="text-3xl font-extrabold md:text-4xl">Featured Vehicles</h2>
              <Link href="/shop" className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">See All</Link>
            </div>
          </Reveal>
          <ScrollRow>
            {featured.map((v) => (
              <div key={v.id} className="w-64 shrink-0 sm:w-72">
                <VehicleCard vehicle={v} />
              </div>
            ))}
          </ScrollRow>
        </div>
      </section>

      {/* ── Heritage · Since 1975 (real archive photos) ──────── */}
      <section className="bg-surface-2 py-16 md:py-24">
        <div className="px-page mx-auto grid max-w-[1400px] items-center gap-12 md:grid-cols-2">
          <Reveal>
            <span className="eyebrow mb-4 text-accent">Est. 1975</span>
            <h2 className="text-3xl font-extrabold leading-tight text-foreground md:text-5xl">Fifty years<br />on the same streets.</h2>
            <p className="mt-5 max-w-md leading-relaxed text-muted">
              Dart Motors has been selling honest, quality used cars in Cape Town since 1975. Different cars, same handshake. Half a century of families driving off our floor is a trust you can&apos;t fake, and don&apos;t rent from anyone.
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              These are the real photos, from the days the sign was hand-painted. The lot has changed. The way we do business hasn&apos;t.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <VintageCarousel />
          </Reveal>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────── */}
      <Reviews />

      {/* ── In-house finance CTA (photo band) ────────────────── */}
      <section className="relative overflow-hidden py-20 text-white md:py-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ready-to-ride.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/65 to-black/80" />
        <div className="px-page relative mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="eyebrow mb-4 text-accent">Financing</p>
            <h2 className="text-3xl font-extrabold leading-tight md:text-4xl">In-house finance made simple.</h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-white/85">No banks. No hassle. Just drive. We finance in-house, so more people get approved. One quick application and you could be driving sooner.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/financing" className="btn-primary rounded-full px-7 py-3.5 text-sm font-semibold">Apply for finance</Link>
              <a href={whatsappLink(`Hi ${dealer.name}, I'd like help finding a car.`)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/20">Chat on WhatsApp</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ (SEO: FAQPage schema) ────────────────────────── */}
      <section className="px-page mx-auto max-w-3xl py-14 md:py-20">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <Reveal>
          <p className="eyebrow mb-3 text-center text-accent">FAQs</p>
          <h2 className="text-center text-3xl font-extrabold md:text-4xl">Questions, answered.</h2>
        </Reveal>
        <div className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {FAQS.map((f, i) => (
            <details key={i} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Newsletter />
      <SourcePopup />
    </>
  );
}
