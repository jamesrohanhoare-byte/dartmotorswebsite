import { Star } from "lucide-react";
import { dealer } from "@/config/dealer";
import Reveal from "@/components/site/Reveal";
import Carousel from "@/components/site/Carousel";

type Review = { name: string; rating: number; text: string };

function ReviewCard({ r, clamp = true }: { r: Review; clamp?: boolean }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6">
      <Stars rating={r.rating} />
      <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium">{r.name}</span>
        <span className="text-xs italic text-muted">Google review</span>
      </figcaption>
      <blockquote
        className={`mt-3 flex-1 text-sm leading-relaxed text-muted ${
          clamp ? "line-clamp-[8] overflow-hidden" : ""
        }`}
      >
        &ldquo;{r.text}&rdquo;
      </blockquote>
    </figure>
  );
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5 text-accent" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, s) => (
        <Star
          key={s}
          size={size}
          className={s < Math.round(rating) ? "fill-current" : "text-border"}
        />
      ))}
    </div>
  );
}

/**
 * Curated Google reviews. Hand-picked entries live in `dealer.reviews`.
 * Shows the real 4.9★ Google aggregate + cards + a "View more" link.
 */
export default function Reviews() {
  const reviews: Review[] = [...(dealer.reviews ?? [])].slice(0, 6);
  if (reviews.length === 0) return null;

  return (
    <section className="px-page mx-auto max-w-[1400px] py-14 md:py-20">
      <Reveal>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">Reviews</p>
            <h2 className="text-3xl leading-tight md:text-4xl">
              What our customers say.
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted">
            <Star size={15} className="fill-accent text-accent" /> Real Google reviews
          </span>
        </div>
      </Reveal>

      {/* Mobile: swipeable carousel (full review text) */}
      <div className="mt-12 md:hidden">
        <Carousel>
          {reviews.map((r, i) => (
            <ReviewCard key={`${r.name}-${i}`} r={r} clamp={false} />
          ))}
        </Carousel>
      </div>
      {/* Desktop: grid */}
      <div className="mt-12 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r, i) => (
          <Reveal key={`${r.name}-${i}`} delay={(i % 3) * 0.08}>
            <ReviewCard r={r} />
          </Reveal>
        ))}
      </div>

      {dealer.googleReviewsUrl && (
        <Reveal>
          <div className="mt-12 flex justify-center">
            <a
              href={dealer.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-7 py-3.5 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              Leave a review
            </a>
          </div>
        </Reveal>
      )}
    </section>
  );
}
