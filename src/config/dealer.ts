// ─────────────────────────────────────────────────────────────────────────
// DEALER CONFIG — single source of truth for Dart Motors' details.
// Content taken verbatim from the live dartmotors.net (James: keep the wording
// + the vintage/heritage feel). ⚠️ items still need confirming from James.
// ─────────────────────────────────────────────────────────────────────────

export const dealer = {
  name: "Dart Motors",
  // Hero — kept verbatim from the live site.
  tagline: "Quality Cars. Trusted Since 1975.",
  heroSub:
    "Explore a wide range of reliable vehicles at Dart Motors, backed by decades of experience and flexible in-house financing to make ownership simple.",
  founder: "Errol",
  established: 1975,

  // CONTACT — confirmed from dartmotors.net
  email: "sales@dartmotors.net",
  phone: "021 465 2675",
  phoneTel: "+27214652675",
  // WhatsApp enquiries — the PRIMARY sales channel. Must appear on every vehicle
  // enquiry (Dart drives sales through WhatsApp). Digits only, international format.
  whatsapp: "27822699882", // +27 82 269 9882

  address: {
    line1: "130 Sir Lowry Rd",
    suburb: "Woodstock",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7925",
    country: "South Africa",
  },
  // ⚠️ Opening hours — not on the current site. Placeholder; confirm with James.
  hours: "Mon to Fri 08:00 to 17:00 · Sat 08:00 to 13:00",
  hoursWeekday: "Mon to Fri 08:00 to 17:00",
  hoursSaturday: "Sat 08:00 to 13:00",

  // SEO
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://dartmotors.net",
  seoRegion: "Woodstock, Cape Town",
  geo: { lat: -33.927, lng: 18.445 }, // approx Woodstock; refine with real listing
  // Socials
  facebook: "https://web.facebook.com/DartMotors",
  instagram: "https://www.instagram.com/dart_motors_official/",
  youtube: "",

  // Trust stats — from the current About page.
  stats: [
    { value: "50+", label: "Years in business" },
    { value: "2000+", label: "Vehicles sold" },
    { value: "98%", label: "Customer satisfaction" },
    { value: "In-House", label: "Financing" },
  ],

  // Heritage story — condensed verbatim from the About page (the vintage soul).
  heritage: [
    "It started in 1965, when founder Errol worked his way through the motor industry before opening the doors of Dart Motors on 6 April 1975.",
    "By the late 1970s Dart had introduced its own in-house financing, with 35 vehicles, a staff of three, and monthly payments from as little as R50 a month. Dart went on to become a registered credit provider with the National Credit Regulator, adding roadworthy certifications, warranties and insurance so customers could do everything under one roof.",
    "Errol built the business on honesty and integrity, values his son Geoff carried forward when he took over in 2017. Today Dart Motors runs 80+ vehicles and a team of eleven, still trading on the same trust it was founded on.",
  ],

  // Team — real photos in /public/team (⚠️ James: confirm name spellings).
  team: [
    { name: "Geoff Fall", role: "Director", photo: "/team/geoff.avif" },
    { name: "Justin Meyer", role: "Manager", photo: "/team/justin.avif" },
    { name: "Jemaine Pietersen", role: "Sales", photo: "/team/jemaine.avif" },
    { name: "Brandon Meyer", role: "Sales", photo: "/team/brandon.avif" },
    { name: "Julia Ndaba", role: "Sales", photo: "/team/julia.avif" },
    { name: "Merancia October", role: "HR / PA", photo: "/team/merancia.avif" },
    { name: "Sonia Leibrandt", role: "Accounts & Reception", photo: "/team/sonia.avif" },
    { name: "Geovon February", role: "Sales Consultant", photo: "/team/geovan.avif" },
  ],

  // Finance: Dart offers IN-HOUSE financing (a key differentiator vs banks).
  // The application is our own multi-step wizard (/financing), not an external link.
  inHouseFinance: true,

  // Real Google reviews (aggregate 3.9 from 175 reviews — used truthfully in
  // schema.org AggregateRating). The cards below are the curated best ones.
  googleRating: 3.9,
  googleReviewCount: 175,
  googleReviewsUrl:
    "https://www.google.com/maps/place/Dart+Motors/@-33.9277393,18.4355617,17z/data=!4m6!3m5!1s0x1dcc5d9b8f6f5747:0xe43dd02ab9dc3981!8m2!3d-33.9277393!4d18.4355617",
  reviews: [
    {
      name: "Mogashan Chetty",
      rating: 5,
      text: "I purchased a vehicle from Dart Motors and was extremely satisfied with Geo the Sales Executive's service. I live in KZN and Geo made the process effortless and stress free. He wasn't pushy and kept me updated every step of the way. I would definitely recommend Geo and Dart Motors if you are looking for a quality vehicle and exceptional service.",
    },
    {
      name: "Christian Sawyer",
      rating: 5,
      text: "Dart Motors are a rarity amongst used car dealers. They were easy to deal with, responsive and stuck to their word! At last, a used car dealership with integrity. I'm impressed! Keep it up.",
    },
    {
      name: "Lameez Carelse",
      rating: 5,
      text: "Exceptional service received from Geo during the purchase of our Kia Picanto. He was knowledgeable and friendly and made the entire process smooth and enjoyable. I am thrilled with my new car! Thanks so much Geo and the Dart Motors team!",
    },
    {
      name: "Joyal Olyn",
      rating: 5,
      text: "With many thanks to Geo, Heidi and their excellent service, the purchase of my first car was a memorable and exciting experience! Thanks so much, keep up the awesome work.",
    },
    {
      name: "Fadwa Salie",
      rating: 5,
      text: "Impressive service from Geovon, who was informative, friendly and helpful. He made what could have been a stressful situation extremely enjoyable. We are delighted with the service from all at Dart Motors and happy with the new vehicle.",
    },
    {
      name: "Seanne Kube",
      rating: 5,
      text: "Amazing service! Quick, professional and made the experience painless and pleasurable. Can definitely recommend them. Thank you, Dart Motors!",
    },
  ] as { name: string; rating: number; text: string }[],

  // Brands Dart commonly stocks (used for SEO keywords; filters derive from live stock).
  featuredBrands: [
    "Toyota",
    "Volkswagen",
    "BMW",
    "Mercedes-Benz",
    "Ford",
    "Hyundai",
    "Kia",
    "Nissan",
    "Isuzu",
    "Suzuki",
  ],
} as const;

/** Build a WhatsApp click-to-chat link with a pre-filled message. */
export function whatsappLink(message: string): string {
  return `https://wa.me/${dealer.whatsapp}?text=${encodeURIComponent(message)}`;
}

/** Pre-filled enquiry message for a specific vehicle. */
export function vehicleEnquiryMessage(v: {
  year: number | null;
  make: string;
  variant: string | null;
  stockId?: string | number | null;
}): string {
  const title = [v.year, v.make, v.variant].filter(Boolean).join(" ");
  const stock = v.stockId ? ` (Stock #${v.stockId})` : "";
  return `Hi ${dealer.name}, I'm interested in the ${title}${stock}. Is it still available?`;
}

/** mailto link with pre-filled subject + body. */
export function emailLink(subject: string, body: string): string {
  return `mailto:${dealer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
