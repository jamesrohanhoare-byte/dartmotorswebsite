import { dealer } from "@/config/dealer";

/**
 * AutoDealer (LocalBusiness) structured data for the homepage.
 * Drives local rich results: NAP, opening hours, map pin, logo, and the
 * 4.9★ Google rating + real reviews (eligible for star rich snippets).
 */
export default function DealerSchema() {
  const reviews = [...(dealer.reviews ?? [])].slice(0, 3);
  const schema = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${dealer.siteUrl}/#dealer`,
    name: dealer.name,
    description: dealer.tagline,
    url: dealer.siteUrl,
    logo: `${dealer.siteUrl}/logo.png`,
    image: `${dealer.siteUrl}/og.jpg`,
    telephone: dealer.phone,
    email: dealer.email,
    priceRange: "$$",
    foundingDate: String(dealer.established),
    address: {
      "@type": "PostalAddress",
      streetAddress: dealer.address.line1,
      addressLocality: dealer.address.suburb,
      addressRegion: dealer.address.province,
      postalCode: dealer.address.postalCode,
      addressCountry: "ZA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: dealer.geo.lat,
      longitude: dealer.geo.lng,
    },
    areaServed: { "@type": "Country", name: "South Africa" },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "17:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "13:00",
      },
    ],
    sameAs: [
      dealer.facebook,
      dealer.instagram,
      dealer.youtube,
      dealer.googleReviewsUrl,
    ].filter(Boolean),
    ...(reviews.length > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(dealer.googleRating ?? 5),
        bestRating: "5",
        reviewCount: dealer.googleReviewCount ?? reviews.length,
      },
      review: reviews.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.name },
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
        reviewBody: r.text,
      })),
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
