import type { Metadata } from "next";
import { getAvailableStock } from "@/lib/queries";
import { dealer } from "@/config/dealer";
import StockGrid from "@/components/site/StockGrid";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Shop Used Cars",
  description: `Browse quality pre-owned cars for sale at ${dealer.name}, ${dealer.seoRegion}. In-house financing available, trusted since 1975.`,
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const stock = await getAvailableStock();
  const makes = [...new Set(stock.map((v) => v.make).filter(Boolean))].sort();

  return (
    <div className="px-page mx-auto max-w-[1400px] py-5 md:py-16">
      <header className="mb-5">
        <p className="eyebrow mb-2">Let&apos;s find your next pick</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-5xl">Our Stock</h1>
        <p className="mt-3 hidden max-w-2xl text-muted sm:block">
          Every vehicle is inspected and ready to drive, backed by decades of
          experience and flexible in-house financing. Purchase or finance, the
          choice is yours.
        </p>
      </header>

      <StockGrid stock={stock} makes={makes} />
    </div>
  );
}
