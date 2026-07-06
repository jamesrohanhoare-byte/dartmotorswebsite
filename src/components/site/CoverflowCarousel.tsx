"use client";

import { useEffect, useRef } from "react";
import type { SiteStock } from "@/lib/types";

// Concave coverflow ("standing inside the ring"): centre car smaller + further
// back, cars grow bigger + closer toward the edges, each rotated to face inward,
// looping. Full-bleed, spacing scales to the viewport. Drag to spin (with
// inertia) — it does NOT move on its own. Purely cosmetic: images only, no text.
export default function CoverflowCarousel({ cars }: { cars: SiteStock[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pos = useRef(0);
  const vel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const dims = useRef({ spacing: 210, depth: 340 });
  const n = cars.length;

  useEffect(() => {
    if (n < 2) return;
    const K = 3.2; // visible cars each side
    const ANGLE = 42; // max inward rotateY

    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 1200;
      dims.current.spacing = Math.min(270, w / 2 / (K + 0.2)); // outer card near the edge
      dims.current.depth = Math.min(380, w * 0.3);
    };
    measure();
    window.addEventListener("resize", measure);

    const wrap = (s: number) => {
      let x = s % n;
      if (x < -n / 2) x += n;
      if (x >= n / 2) x -= n;
      return x;
    };

    let raf = 0;
    const tick = () => {
      if (!dragging.current) {
        pos.current += vel.current;
        vel.current *= 0.92;
        if (Math.abs(vel.current) < 0.0004) vel.current = 0;
      }
      const { spacing, depth } = dims.current;
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const s = wrap(i - pos.current);
        if (Math.abs(s) > K + 0.8) {
          el.style.opacity = "0";
          continue;
        }
        const c = Math.max(-K, Math.min(K, s));
        const x = s * spacing;
        const z = -depth * (1 - Math.pow(c / K, 2));
        const ry = -c * ANGLE;
        el.style.transform = `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg)`;
        el.style.opacity = Math.abs(s) > K ? String(Math.max(0, 1 - (Math.abs(s) - K) / 0.8)) : "1";
        el.style.zIndex = String(Math.round(1000 + z));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [n]);

  if (n < 2) return null;

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    vel.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const d = (e.clientX - lastX.current) / dims.current.spacing;
    lastX.current = e.clientX;
    pos.current -= d;
    vel.current = -d;
  };
  const onUp = () => {
    dragging.current = false;
  };

  return (
    // full-bleed: break out of the page container to span the viewport width
    <div ref={wrapRef} className="relative left-1/2 w-screen -translate-x-1/2">
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="relative mx-auto h-[250px] w-full cursor-grab touch-pan-y select-none overflow-hidden [perspective:1100px] active:cursor-grabbing sm:h-[320px] md:h-[380px]"
      >
        {cars.map((car, i) => {
          const lead = car.images?.[0];
          return (
            <div
              key={car.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute left-1/2 top-1/2 h-[150px] w-[210px] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl [backface-visibility:hidden] will-change-transform sm:h-[190px] sm:w-[260px] md:h-[220px] md:w-[300px]"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              {lead ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lead} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">Dart Motors</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
