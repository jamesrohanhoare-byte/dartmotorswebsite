// Maroon scrolling ticker bar (matches the current site's top strip).
const PHRASES = [
  "Quality Used Cars Since 1975",
  "Built on Trust. Backed by Finance",
  "Drive Now, Pay Your Way",
  "Vehicle Finance Available",
  "Vehicle Finance, Sorted",
];

export default function Ticker() {
  // Duplicate the list so the marquee loops seamlessly.
  const items = [...PHRASES, ...PHRASES];
  return (
    <div className="overflow-hidden bg-maroon text-white">
      <div className="flex w-max animate-[ticker_28s_linear_infinite] whitespace-nowrap py-2">
        {items.map((p, i) => (
          <span key={i} className="mx-6 text-[0.72rem] font-medium uppercase tracking-wide">
            {p}
            <span className="mx-6 text-white/40">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
