/**
 * Temporary promo prices, keyed by car slug (`stock-{stockID}`, the /shop URL).
 *
 * Lives in code, not in site_stock, on purpose: the VMG sync owns site_stock.price
 * and rewrites it every run, so nothing here can be overwritten by the feed, and
 * nothing here can corrupt it. lib/stock/promo.ts applies these on read for the
 * website AND the Meta catalog, so posts, site and ads show the same number.
 *
 * Every entry MUST have an end date. A promo stops by itself at `endsAt`, when the
 * car sells, or if VMG drops the real price to or below the promo price.
 * To end one early: delete its line and deploy.
 */

export interface Promo {
  price: number; // whole rand
  label: string; // badge text
  endsAt: string; // ISO instant; the promo is off from this moment
}

// Black Friday 2026: Geoff's list (WhatsApp, 2026-11-25). Runs one week.
// 2026-12-02 23:59 SAST = 21:59 UTC.
const BLACK_FRIDAY_2026 = { label: "Black Friday Special", endsAt: "2026-12-02T21:59:00.000Z" };

export const PROMOS: Record<string, Promo> = {
  "stock-1102": { price: 299995, ...BLACK_FRIDAY_2026 }, // 2011 Hilux, was 319 995
  "stock-1054": { price: 469995, ...BLACK_FRIDAY_2026 }, // 2020 Fortuner, was 479 995
  "stock-1017": { price: 279995, ...BLACK_FRIDAY_2026 }, // 2013 Prado, was 289 995
  "stock-922": { price: 309995, ...BLACK_FRIDAY_2026 }, // 2012 Pajero, was 319 995
  "stock-1043": { price: 99995, ...BLACK_FRIDAY_2026 }, // 2011 Grand Vitara, was 109 995
  "stock-902": { price: 289995, ...BLACK_FRIDAY_2026 }, // 2015 VW T5, was 299 995
  "stock-893": { price: 79995, ...BLACK_FRIDAY_2026 }, // 2009 Mini Cooper S JCW, was 84 995
};
