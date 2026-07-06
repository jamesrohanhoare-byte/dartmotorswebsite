import type { Metadata } from "next";
import { MapPin, Clock, Phone, Mail, MessageCircle } from "lucide-react";
import { dealer, whatsappLink } from "@/config/dealer";
import ContactForm from "@/components/site/ContactForm";
import Socials from "@/components/site/Socials";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact Dart Motors",
  description: `Get in touch with ${dealer.name} in ${dealer.seoRegion}. Call, WhatsApp or email us, or visit the showroom at ${dealer.address.line1}, ${dealer.address.suburb}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const items = [
    { icon: MapPin, label: "Visit us", value: `${dealer.address.line1}, ${dealer.address.suburb}, ${dealer.address.city}` },
    { icon: Clock, label: "Hours", value: `${dealer.hoursWeekday}\n${dealer.hoursSaturday}` },
    { icon: Phone, label: "Call us", value: dealer.phone, href: `tel:${dealer.phoneTel}` },
    { icon: Mail, label: "Email us", value: dealer.email, href: `mailto:${dealer.email}` },
  ];

  return (
    <div className="px-page mx-auto max-w-[1400px] py-10 md:py-14">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Left: heading + details + form */}
        <div>
          <p className="eyebrow mb-3 text-accent">Contact</p>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">Get in touch</h1>
          <p className="mt-3 max-w-xl text-muted">
            Found a car you like, or have a question? The team is ready to help, with
            honest advice and flexible in-house finance.
          </p>

          <Socials className="mt-5" />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {items.map((it) => {
              const inner = (
                <>
                  <it.icon size={18} className="text-accent" />
                  <div className="mt-2.5 text-xs uppercase tracking-wider text-muted">{it.label}</div>
                  <div className="mt-1 whitespace-pre-line text-sm font-medium">{it.value}</div>
                </>
              );
              return it.href ? (
                <a key={it.label} href={it.href} className="rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent">{inner}</a>
              ) : (
                <div key={it.label} className="rounded-2xl border border-border bg-surface p-4">{inner}</div>
              );
            })}
          </div>

          {dealer.whatsapp && (
            <a
              href={whatsappLink(`Hi ${dealer.name}, I have an enquiry.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold"
            >
              <MessageCircle size={18} /> Chat to us on WhatsApp
            </a>
          )}

          <div className="mt-8">
            <h2 className="mb-4 text-lg font-bold">Send us a message</h2>
            <ContactForm />
          </div>
        </div>

        {/* Right: map, tall + sticky so it fills the column */}
        <div className="overflow-hidden rounded-2xl border border-border lg:sticky lg:top-24 lg:h-[620px]">
          <iframe
            title={`${dealer.name} location`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(`${dealer.address.line1}, ${dealer.address.suburb}, ${dealer.address.city}`)}&output=embed`}
            className="h-full min-h-[360px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
