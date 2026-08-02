import type { Metadata } from "next";
import { getAvailableStock } from "@/lib/queries";
import { dealer } from "@/config/dealer";
import { isJustIn } from "@/lib/format";
import StockGrid from "@/components/site/StockGrid";

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

      {/* Search and filters come FIRST, above Just In. They used to sit below
          it, so a search left the top of the page unchanged and looked like it
          had found nothing. StockGrid now owns the Just In strip and drops it
          the moment the visitor starts filtering. */}
      <StockGrid stock={stock} makes={makes} justIn={justIn} />
    </div>
  );
}
