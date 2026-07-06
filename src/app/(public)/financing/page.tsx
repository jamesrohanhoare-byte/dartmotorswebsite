import type { Metadata } from "next";
import { dealer } from "@/config/dealer";
import FinanceWizard from "@/components/site/FinanceWizard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "In-House Vehicle Finance",
  description: `Apply for in-house car finance at ${dealer.name}. No banks, no hassle. Fill in the form to see if you qualify.`,
  alternates: { canonical: "/financing" },
};

const faqs = [
  { q: "How does in-house finance work?", a: "We finance vehicles ourselves rather than sending you to a bank, which means we can approve more people and keep the process simple. You apply once, we assess it, and you drive away sorted." },
  { q: "What do I need to apply?", a: "Your ID, proof of income such as recent payslips or bank statements, and proof of residence. The form below captures everything we need to get started." },
  { q: "Will applying affect my credit?", a: "A credit check forms part of the assessment, which you consent to when you submit. We only run it to assess your application." },
];

export default async function FinancingPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string; stock?: string }>;
}) {
  const { vehicle, stock } = await searchParams;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-gradient-to-br from-maroon to-[#3a1010] py-16 text-center text-white md:py-20">
        <div className="px-page mx-auto max-w-3xl">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium">Here to help you</span>
          <h1 className="mt-4 text-4xl font-bold md:text-5xl">Financing</h1>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            No banks. No hassle. Just drive. Fill in the form below to see if you qualify for our in-house financing.
          </p>
        </div>
      </section>

      <section className="px-page mx-auto max-w-[1400px] py-14 md:py-16">
        <FinanceWizard defaultVehicle={vehicle ?? ""} defaultStockSlug={stock ?? ""} />
      </section>

      <section className="px-page mx-auto max-w-2xl pb-20">
        <h2 className="mb-6 text-2xl font-bold">Common questions</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
