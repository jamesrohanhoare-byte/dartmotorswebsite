import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { dealer } from "@/config/dealer";

// Inter throughout — the same typeface the live Framer site uses.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const title = `${dealer.name} | Trusted Used Cars & In-House Finance in Cape Town`;
const description = `${dealer.name}. Quality pre-owned cars in ${dealer.seoRegion}, trusted since 1975. In-house financing, no banks. Browse our stock and drive away.`;

export const metadata: Metadata = {
  metadataBase: new URL(dealer.siteUrl),
  title: {
    default: title,
    template: `%s | ${dealer.name}`,
  },
  description,
  keywords: [
    "used cars Cape Town",
    "used cars Woodstock",
    "in-house car finance Cape Town",
    "car finance no bank",
    "pre-owned cars Cape Town",
    "Dart Motors",
    ...dealer.featuredBrands.map((b) => `used ${b} for sale Cape Town`),
  ],
  openGraph: {
    type: "website",
    siteName: dealer.name,
    locale: "en_ZA",
    url: dealer.siteUrl,
    title,
    description,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: `${dealer.name}, trusted used cars in Cape Town since 1975` }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZA"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
