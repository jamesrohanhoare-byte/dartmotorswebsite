"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cdnImg } from "@/lib/img";

/**
 * Premium car gallery. A scroll-snap main image (swipe / arrows) with a row of
 * thumbnails; tap the main image to open a full-screen lightbox (swipeable).
 * Images are hotlinked from VMG's S3 via plain <img> — never re-hosted.
 */
export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const count = images.length;

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setActive(Math.max(0, Math.min(count - 1, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [count]);

  useEffect(() => {
    const row = thumbsRef.current;
    const thumb = row?.children[active] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  // Lock body scroll + wire arrow/escape keys while the lightbox is open.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setActive((a) => Math.min(count - 1, a + 1));
      if (e.key === "ArrowLeft") setActive((a) => Math.max(0, a - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, count]);

  // Reset zoom/pan when the photo changes or the lightbox toggles.
  useEffect(() => {
    setZoom(false);
    setPan({ x: 0, y: 0 });
  }, [active, lightbox]);

  const toggleZoom = () =>
    setZoom((z) => {
      if (z) setPan({ x: 0, y: 0 });
      return !z;
    });
  const onImgDown = (e: React.PointerEvent) => {
    if (!zoom) return;
    drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onImgMove = (e: React.PointerEvent) => {
    if (!zoom || !drag.current) return;
    setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onImgUp = () => {
    drag.current = null;
  };

  function goTo(i: number) {
    const el = mainRef.current;
    if (!el) return;
    const c = Math.max(0, Math.min(count - 1, i));
    el.scrollTo({ left: c * el.clientWidth, behavior: "smooth" });
    setActive(c);
  }

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-border bg-surface text-muted">
        Photos coming soon
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-surface-2">
        <div
          ref={mainRef}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
        >
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(true)}
              aria-label="View full screen"
              className="relative h-full w-full shrink-0 cursor-zoom-in snap-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cdnImg(src, 1400, 82)}
                alt={`${alt} — photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>

        <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Expand size={13} /> Full screen
        </span>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => goTo(active - 1)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-900 backdrop-blur transition-colors hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => goTo(active + 1)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-900 backdrop-blur transition-colors hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur">
              {active + 1} / {count}
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <div ref={thumbsRef} className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg border transition-opacity ${
                i === active ? "border-accent" : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cdnImg(src, 200)} alt={`${alt} — thumbnail ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Full-screen lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm">{active + 1} / {count}</span>
            <button type="button" aria-label="Close" onClick={() => setLightbox(false)} className="rounded-full p-2 hover:bg-white/10">
              <X size={22} />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[active]}
              alt={`${alt} — photo ${active + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleZoom();
              }}
              onPointerDown={onImgDown}
              onPointerMove={onImgMove}
              onPointerUp={onImgUp}
              onPointerLeave={onImgUp}
              draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom ? 2.5 : 1})` }}
              className={`max-h-full max-w-full touch-none select-none object-contain ${zoom ? "cursor-grab" : "cursor-zoom-in"} ${drag.current ? "" : "transition-transform duration-200"}`}
            />
            {count > 1 && (
              <>
                <button type="button" aria-label="Previous" onClick={() => setActive((a) => Math.max(0, a - 1))} className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <ChevronLeft size={26} />
                </button>
                <button type="button" aria-label="Next" onClick={() => setActive((a) => Math.min(count - 1, a + 1))} className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <ChevronRight size={26} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
