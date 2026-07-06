"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HERITAGE_PHOTOS } from "@/config/heritage";

// Auto cross-fading vintage photo carousel with a nostalgic framed treatment.
// Advances every 4.5s; dots let you jump. Mirrors the site's plain-img + framer
// pattern (no next/image, matching the rest of this build).
export default function VintageCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = HERITAGE_PHOTOS.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 4500);
    return () => clearInterval(t);
  }, [paused, n]);

  const active = HERITAGE_PHOTOS[i];
  const prev = () => setI((p) => (p - 1 + n) % n);
  const next = () => setI((p) => (p + 1) % n);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* prev / next arrows */}
      <button
        onClick={prev}
        aria-label="Previous photo"
        className="absolute -left-1 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-neutral-800 shadow-md transition-colors hover:bg-white sm:-left-3"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        aria-label="Next photo"
        className="absolute -right-1 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-neutral-800 shadow-md transition-colors hover:bg-white sm:-right-3"
      >
        <ChevronRight size={18} />
      </button>
      {/* Framed photo — subtle tilt + aged border for the archive feel */}
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[560px] rotate-[-1.2deg] rounded-sm bg-[#f4efe6] p-2.5 shadow-2xl ring-1 ring-black/10 sm:p-3">
        <div className="relative h-full w-full overflow-hidden rounded-[2px]">
          <AnimatePresence mode="wait">
            <motion.img
              key={active.src}
              src={active.src}
              alt={active.caption}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
          {/* warm vintage wash */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-900/15 via-transparent to-amber-100/10 mix-blend-multiply" />
        </div>
        {/* handwritten-style caption on the polaroid border */}
        <div className="px-1 pt-2 pb-0.5">
          <AnimatePresence mode="wait">
            <motion.p
              key={active.caption}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center text-[13px] font-medium italic text-neutral-700"
            >
              {active.caption}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* dots */}
      <div className="mt-6 flex justify-center gap-2.5">
        {HERITAGE_PHOTOS.map((_, d) => (
          <button
            key={d}
            aria-label={`Show photo ${d + 1}`}
            onClick={() => setI(d)}
            className={`h-2 rounded-full transition-all ${
              d === i ? "w-7 bg-accent" : "w-2 bg-black/15 hover:bg-black/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
