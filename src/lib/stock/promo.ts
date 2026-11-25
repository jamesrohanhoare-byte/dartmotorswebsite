import { PROMOS, type Promo } from "../../config/promos.ts";

/**
 * Temporary promo prices (first use: Black Friday 2026, Geoff's 7 cars).
 *
 * THE RULE THAT KEEPS THE FEED SAFE
 * ---------------------------------
 * The VMG sync owns `price` and rewrites it every run. A promo never touches the
 * stored price: promos live in config/promos.ts and are applied on READ, here.
 * Every read goes through it: the website (queries.ts) and the Meta catalog
 * (queries-feed.ts). So the shop card, the car page, the Google schema, the pixel
 * value AND the catalog ads all show the same number and cannot disagree.
 *
 * A promo ends by itself:
 *  - at its end date (required: a promo with no end date never runs),
 *  - when the car sells (sold cars leave every listing anyway),
 *  - if VMG drops the real price to or below the promo price (the lower real
 *    price wins, and the "was" price would be a lie).
 */

export interface PromoInput {
  slug: string;
  price: number | null;
}

export function isPromoActive(
  price: number | null,
  promo: Promo | undefined,
  now: number = Date.now(),
): promo is Promo {
  if (!promo || !price || price <= 0) return false;
  if (!promo.price || promo.price <= 0 || promo.price >= price) return false;
  if (!promo.endsAt) return false;
  const ends = Date.parse(promo.endsAt);
  return Number.isFinite(ends) && ends > now;
}

/** The car with its live price. `was_price` and `promo_label` are set only while a promo runs. */
export function applyPromo<T extends PromoInput>(
  v: T,
  now: number = Date.now(),
  promos: Record<string, Promo> = PROMOS,
): T & { was_price: number | null; promo_label: string | null } {
  const promo = promos[v.slug];
  if (!isPromoActive(v.price, promo, now)) return { ...v, was_price: null, promo_label: null };
  return { ...v, price: promo.price, was_price: v.price, promo_label: promo.label };
}
