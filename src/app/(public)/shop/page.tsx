import type { Metadata } from "next";
import { getAvailableStock } from "@/lib/queries";
import { dealer } from "@/config/dealer";
import { isJustIn, JUST_IN_DAYS } from "@/lib/format";
import StockGrid from "@/components/site/StockGrid";
import VehicleCard from "@/components/site/VehicleCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Shop Used Cars",
  description: `Browse quality pre-owned cars for sale at ${dealer.name}, ${dealer.seoRegion}. Vehicle financing available, trusted since 1975.`,
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const stock = await getAvailableStock();
  const makes = [...new Set(stock.map((v) => v.make).filter(Boolean))].sort();
  const justIn = stock
    .filter(isJustIn)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="px-page mx-auto max-w-[1400px] py-5 md:py-16">
      <header className="mb-5">
        <p className="eyebrow mb-2">Let&apos;s find your next pick</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-5xl">Our Stock</h1>
        <p className="mt-3 hidden max-w-2xl text-muted sm:block">
          Every vehicle is inspected and ready to drive, backed by decades of
          experience and vehicle financing. Purchase or finance, the
          choice is yours.
        </p>
      </header>

      {justIn.length > 0 && (
        <section aria-labelledby="just-in" className="mb-10 md:mb-16">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="just-in" className="text-xl font-bold tracking-tight md:text-2xl">
              Just In
            </h2>
            <p className="text-sm text-muted">Listed in the last {JUST_IN_DAYS} days</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {justIn.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </section>
      )}

      {justIn.length > 0 && (
        <h2 className="mb-4 text-xl font-bold tracking-tight md:text-2xl">All Stock</h2>
      )}
      <StockGrid stock={stock} makes={makes} />
    </div>
  );
}
