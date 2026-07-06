import Link from "next/link";
import type { SiteStock } from "@/lib/types";
import { formatPrice, formatMileage, stockTitle } from "@/lib/format";
import { cdnImg } from "@/lib/img";

// Stock card. Images are hotlinked straight from VMG's S3 via a plain <img>
// (loading="lazy") — never next/image — so photos never touch our bandwidth.
export default function VehicleCard({
  vehicle,
  sold = false,
}: {
  vehicle: SiteStock;
  sold?: boolean;
}) {
  const lead = vehicle.images?.[0];
  const title = stockTitle(vehicle);

  const content = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {lead ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnImg(lead, 640)}
            alt={title}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-transform duration-500 ${sold ? "opacity-90" : "group-hover:scale-105"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Photos coming soon
          </div>
        )}
        {sold ? (
          <span className="absolute left-3 top-3 rounded-full bg-maroon px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-white">
            Sold
          </span>
        ) : vehicle.featured ? (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-white">
            Featured
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className={`text-lg font-bold ${sold ? "text-muted" : "text-foreground"}`}>
          {sold ? "Sold" : formatPrice(vehicle.price)}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground/90">
          {title}
        </h3>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="rounded-md bg-surface-2 px-2 py-1">{formatMileage(vehicle.mileage)}</span>
          {vehicle.condition && <span>{vehicle.condition}</span>}
        </div>
      </div>
    </>
  );

  if (sold) {
    return (
      <div className="block overflow-hidden rounded-2xl border border-border bg-surface">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/shop/${vehicle.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5"
    >
      {content}
    </Link>
  );
}
