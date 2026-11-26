import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getPromoStock } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import VehicleCard from "@/components/site/VehicleCard";

// Temporary promo page (Black Friday 2026). It lists whatever lib/stock/promo.ts
// says is on a live promo, so it empties itself as cars sell or the promo ends,
// and then sends visitors to the full stock list instead of showing nothing.
export const revalidate = 86400; // same 24h net as every page (Vercel-Hosting-Hygiene §2); a deploy refreshes it

export const metadata: Metadata = {
  title: "Black Friday Deals",
  description: "Black Friday specials on selected quality used cars at Dart Motors, Cape Town.",
  alternates: { canonical: "/black-friday" },
  // Short-lived page: keep it out of Google so it never outlives the deal there.
  robots: { index: false, follow: true },
};

export default async function BlackFridayPage() {
  const stock = await getPromoStock();
  if (stock.length === 0) redirect("/shop");

  const saving = Math.max(...stock.map((v) => (v.was_price ?? 0) - (v.price ?? 0)));

  return (
    <div className="px-page mx-auto max-w-[1400px] py-5 md:py-16">
      <header className="mb-8">
        <span className="inline-block rounded-full bg-[#ffd400] px-4 py-1.5 text-sm font-black uppercase tracking-wider text-black">
          Limited time
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">Black Friday Deals</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {stock.length} hand-picked {stock.length === 1 ? "car" : "cars"} with up to{" "}
          <span className="font-bold text-[#ffd400]">{formatPrice(saving)} off</span>, for a
          limited time only. Every one is inspected and ready to drive, with finance available.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stock.map((v) => (
          <VehicleCard key={v.slug} vehicle={v} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          See all our stock <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
