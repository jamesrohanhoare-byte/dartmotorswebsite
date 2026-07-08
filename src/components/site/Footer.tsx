import { dealer } from "@/config/dealer";
import Socials from "@/components/site/Socials";

export default function Footer({ logoUrl }: { logoUrl?: string | null }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-[#1b1712] text-white">
      <div className="px-page mx-auto max-w-[1400px] py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="md:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl || "/dart-logo.png"}
              alt={dealer.name}
              className="h-16 w-auto"
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              {dealer.tagline}<br />Find the right car, without the hassle.
            </p>
            <Socials className="mt-5" />
          </div>

          <div>
            <div className="eyebrow mb-4 text-white/50">Visit / Contact</div>
            <ul className="space-y-2 text-sm text-white/70">
              <li>{dealer.address.line1}</li>
              <li>{dealer.address.suburb}, {dealer.address.city}</li>
              <li>{dealer.hoursWeekday}</li>
              <li>{dealer.hoursSaturday}</li>
              <li><a href={`tel:${dealer.phoneTel}`} className="transition-colors hover:text-white">{dealer.phone}</a></li>
              <li><a href={`mailto:${dealer.email}`} className="transition-colors hover:text-white">{dealer.email}</a></li>
            </ul>
          </div>
        </div>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-white/45">
          Prices include VAT but exclude on-the-road costs. Prices are subject to stock
          availability and may change without notice. Finance is subject to approval.
        </p>

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/55 md:flex-row md:items-center md:justify-between">
          <span>© {year} {dealer.name}. All rights reserved.</span>
          <div className="flex items-center gap-4">
            {dealer.googleReviewsUrl && (
              <>
                <a
                  href={dealer.googleReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  Google reviews
                </a>
                <span className="text-white/20">·</span>
              </>
            )}
            <a
              href="https://socialagencies.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Powered by Social Agencies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
