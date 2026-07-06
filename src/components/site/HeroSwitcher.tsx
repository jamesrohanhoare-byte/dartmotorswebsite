"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { dealer } from "@/config/dealer";
import { HERITAGE_PHOTOS } from "@/config/heritage";

// "Then & Now" interactive hero: the big image is switchable. Default is the
// modern showroom; tapping a vintage thumbnail cross-fades the hero to a real
// archive photo. Delivers the original site's click-to-change-hero concept.
const SLIDES = [
  { src: "/hero.jpg", label: "Today", caption: "The Dart Motors floor today" },
  ...HERITAGE_PHOTOS.map((p) => ({ src: p.src, label: "Then", caption: p.caption })),
];

export default function HeroSwitcher() {
  const [i, setI] = useState(0);
  const active = SLIDES[i];

  return (
    <section className="relative flex min-h-[68vh] items-center justify-center overflow-hidden text-white">
      <AnimatePresence>
        <motion.img
          key={active.src}
          src={active.src}
          alt={active.caption}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/45 to-black/75" />

      <div className="px-page relative mx-auto w-full max-w-3xl pt-24 pb-12 text-center">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold">Premium · {dealer.name}</span>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-[1.05] md:text-6xl lg:text-7xl">
          {dealer.tagline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{dealer.heroSub}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/shop" className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold sm:w-auto">
            See all collections <ArrowRight size={16} />
          </Link>
          <Link href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/20 sm:w-auto">
            Contact us
          </Link>
        </div>

        {/* Then & Now switcher */}
        <div className="mt-9">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/60">50 years in the making — tap to look back</p>
          <div className="no-scrollbar flex justify-start gap-2.5 overflow-x-auto pb-1 sm:justify-center">
            {SLIDES.map((s, d) => (
              <button
                key={s.src}
                onClick={() => setI(d)}
                aria-label={s.caption}
                className={`relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all md:h-16 md:w-28 ${
                  d === i ? "border-accent" : "border-white/25 opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
