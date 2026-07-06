import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getStockBySlug, getAllStockSlugs, getRelatedStock } from "@/lib/queries";
import { dealer, vehicleEnquiryMessage } from "@/config/dealer";
import {
  formatPrice,
  formatMileage,
  stockTitle,
  stockFeatures,
  transmissionFromVariant,
} from "@/lib/format";
import Gallery from "@/components/site/Gallery";
import VehicleEnquiry from "@/components/site/VehicleEnquiry";
import VehicleCard from "@/components/site/VehicleCard";
import ScrollRow from "@/components/site/ScrollRow";

export const revalidate = 3600;
// Cars added by a sync after the last build still render on-demand (then cache).
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllStockSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const v = await getStockBySlug(slug);
  if (!v) return { title: "Vehicle not found" };
  const title = `${stockTitle(v)} · ${formatPrice(v.price)}`;
  const description = `${stockTitle(v)} for sale at ${dealer.name}, ${dealer.seoRegion}. ${formatMileage(v.mileage)}${v.colour ? `, ${v.colour}` : ""}. In-house finance available. Enquire today.`;
  const image = v.images?.[0];
  return {
    title,
    description,
    alternates: { canonical: `/shop/${v.slug}` },
    openGraph: { title, description, images: image ? [{ url: image }] : undefined, type: "website" },
    twitter: image ? { card: "summary_large_image", title, description, images: [image] } : undefined,
  };
}

export default async function VehiclePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const v = await getStockBySlug(slug);
  if (!v) notFound();

  const title = stockTitle(v);
  const msg = vehicleEnquiryMessage({ year: v.year, make: v.make, variant: v.variant, stockId: v.stock_id });
  const transmission = transmissionFromVariant(v.variant);
  const features = stockFeatures(v.extras);
  const related = await getRelatedStock(v.slug, 8);

  // Spec grid — only whatever the feed actually gives us for this car.
  const specs: { label: string; value: string }[] = [
    ...(v.year ? [{ label: "Year", value: String(v.year) }] : []),
    { label: "Mileage", value: formatMileage(v.mileage) },
    ...(transmission ? [{ label: "Transmission", value: transmission }] : []),
    ...(v.colour ? [{ label: "Colour", value: v.colour }] : []),
    ...(v.condition ? [{ label: "Condition", value: v.condition }] : []),
    ...(v.new_used ? [{ label: "Type", value: v.new_used }] : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: title,
    url: `${dealer.siteUrl}/shop/${v.slug}`,
    brand: { "@type": "Brand", name: v.make },
    ...(v.variant ? { model: v.variant } : {}),
    ...(v.year ? { vehicleModelDate: String(v.year) } : {}),
    ...(v.mileage ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" } } : {}),
    ...(transmission ? { vehicleTransmission: transmission } : {}),
    ...(v.colour ? { color: v.colour } : {}),
    image: v.images, // absolute S3 URLs
    offers: {
      "@type": "Offer",
      priceCurrency: "ZAR",
      ...(v.price ? { price: v.price } : {}),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: { "@type": "AutoDealer", name: dealer.name },
    },
  };

  return (
    <div className="px-page mx-auto max-w-[1400px] py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/shop" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ChevronLeft size={16} /> Back to all stock
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-x-12">
        {/* Gallery — 1st on mobile, top-left on desktop */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Gallery images={v.images} alt={title} />
        </div>

        {/* Price + specs + enquiry — 2nd on mobile (up top, it has to sell),
            sticky right column on desktop. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:sticky lg:top-24">
          <p className="eyebrow mb-2">{v.make}</p>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
          <div className="mt-2 text-2xl font-bold text-accent">{formatPrice(v.price)}</div>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {specs.map((s, i) => (
              <div
                key={s.label}
                className={`bg-surface p-4 ${i === specs.length - 1 && specs.length % 2 === 1 ? "col-span-2" : ""}`}
              >
                <dt className="text-xs uppercase tracking-wider text-muted">{s.label}</dt>
                <dd className="mt-1 text-sm font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <VehicleEnquiry stockSlug={v.slug} title={title} message={msg} emailSubject={`Enquiry: ${title}`} />
            <Link href={`/financing?vehicle=${encodeURIComponent(title)}`} className="mt-3 block rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent">
              Apply for in-house finance on this car →
            </Link>
          </div>
        </div>

        {/* Features + description — last on mobile, below the gallery on desktop */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {features.length > 0 && (
            <div>
              <p className="eyebrow mb-3">Features &amp; extras</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-foreground/80 sm:grid-cols-3">
                {features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {v.description && (
            <div className="mt-8 border-t border-border pt-6">
              <p className="eyebrow mb-3">Description</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{v.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* You may also like — sideways-swipe row (mobile friendly) */}
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="mb-5 text-xl font-bold">You may also like</h2>
          <ScrollRow>
            {related.map((r) => (
              <div key={r.id} className="w-60 shrink-0 sm:w-64">
                <VehicleCard vehicle={r} />
              </div>
            ))}
          </ScrollRow>
        </div>
      )}
    </div>
  );
}
