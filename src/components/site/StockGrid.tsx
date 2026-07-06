"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { SiteStock } from "@/lib/types";
import { stockTitle } from "@/lib/format";
import VehicleCard from "@/components/site/VehicleCard";

type Sort = "featured" | "price-desc" | "price-asc" | "year-desc" | "km-asc";

const PRICE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Under R100k", min: 0, max: 100_000 },
  { label: "R100k to R200k", min: 100_000, max: 200_000 },
  { label: "R200k to R300k", min: 200_000, max: 300_000 },
  { label: "R300k plus", min: 300_000, max: Number.MAX_SAFE_INTEGER },
];

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full sm:w-auto sm:min-w-[160px]">
      <select
        value={value}
        onChange={onChange}
        className="h-11 w-full cursor-pointer appearance-none rounded-full border border-border bg-surface pl-4 pr-10 text-sm text-foreground outline-none transition-colors hover:border-muted focus:border-accent"
      >
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export default function StockGrid({ stock, makes }: { stock: SiteStock[]; makes: string[] }) {
  const [query, setQuery] = useState("");
  const [make, setMake] = useState("All");
  const [band, setBand] = useState("All");
  const [sort, setSort] = useState<Sort>("featured");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bandDef = PRICE_BANDS.find((b) => b.label === band);
    const list = stock.filter((v) => {
      const matchMake = make === "All" || v.make === make;
      const p = v.price ?? 0;
      const matchBand = !bandDef || (p >= bandDef.min && p < bandDef.max);
      const matchQuery = !q || stockTitle(v).toLowerCase().includes(q);
      return matchMake && matchBand && matchQuery;
    });
    const priceAsc = (v: SiteStock) => v.price ?? Number.MAX_SAFE_INTEGER;
    return [...list].sort((a, b) => {
      switch (sort) {
        case "price-desc": return (b.price ?? 0) - (a.price ?? 0);
        case "price-asc": return priceAsc(a) - priceAsc(b);
        case "year-desc": return (b.year ?? 0) - (a.year ?? 0);
        case "km-asc": return (a.mileage ?? 1e9) - (b.mileage ?? 1e9);
        default:
          return Number(b.featured) - Number(a.featured) || (b.price ?? 0) - (a.price ?? 0);
      }
    });
  }, [stock, query, make, band, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search make, model or year"
            className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm outline-none transition-colors hover:border-muted focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:contents">
          <SelectField value={make} onChange={(e) => setMake(e.target.value)}>
            <option value="All">All makes</option>
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </SelectField>

          <SelectField value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="All">Any price</option>
            {PRICE_BANDS.map((b) => (
              <option key={b.label} value={b.label}>{b.label}</option>
            ))}
          </SelectField>

          <SelectField value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="featured">Sort: Featured</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="year-desc">Year: Newest</option>
            <option value="km-asc">Mileage: Lowest</option>
          </SelectField>
        </div>
      </div>

      <p className="py-3 text-sm text-muted sm:py-6">
        {filtered.length} {filtered.length === 1 ? "vehicle" : "vehicles"} available
      </p>

      {filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-muted">No vehicles match your search.</p>
      )}
    </div>
  );
}
