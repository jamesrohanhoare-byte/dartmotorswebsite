"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { dealer, whatsappLink } from "@/config/dealer";

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "number" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  half?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  pattern?: RegExp; // if set, a non-empty value must match to advance
  hint?: string; // shown in red when the value fails `pattern`
};

// Mirrors Dart Motors' real paper finance application, kept multi-step so each
// screen stays short. New fields land in site_finance_applications.details
// (JSONB) automatically — no migration needed; add a label in /api/finance too.
const STEPS: { title: string; fields: Field[] }[] = [
  {
    title: "Personal",
    fields: [
      { name: "name", label: "Full Names", required: true, half: true },
      { name: "surname", label: "Surname", required: true, half: true },
      { name: "idNumber", label: "SA ID Number", required: true, inputMode: "numeric", maxLength: 13, pattern: /^\d{13}$/, hint: "Enter all 13 digits of your SA ID.", placeholder: "13-digit ID number" },
      { name: "dob", label: "Date of Birth", type: "date", required: true, half: true },
      { name: "maritalStatus", label: "Married / Single", type: "select", options: ["Married", "Single"], required: true, half: true },
    ],
  },
  {
    title: "Home & Contact",
    fields: [
      { name: "address", label: "Home Address", required: true, placeholder: "123 Hope St, Cape Town" },
      { name: "timeAtAddress", label: "Term at Home Address", half: true, placeholder: "e.g. 2 years" },
      { name: "homeStatus", label: "Bonded or Rent?", type: "select", options: ["Rent", "Bonded", "Own (paid off)", "Living with family"], required: true, half: true },
      { name: "bondBank", label: "If bonded, which bank?", half: true, placeholder: "e.g. Standard Bank" },
      { name: "phone", label: "Cell Phone Number", type: "tel", required: true, half: true, placeholder: "000 000 0000" },
      { name: "email", label: "Email Address", type: "email", required: true, half: true, placeholder: "you@email.com" },
    ],
  },
  {
    title: "Employment",
    fields: [
      { name: "employerName", label: "Company Name", required: true, half: true, placeholder: "Employer" },
      { name: "workAddress", label: "Work Address", placeholder: "Company address" },
      { name: "timeEmployed", label: "Term at Work", half: true, placeholder: "e.g. 3 years" },
      { name: "employerContact", label: "Work Tel Number", type: "tel", half: true, placeholder: "000 000 0000" },
      { name: "jobTitle", label: "Occupation", half: true, placeholder: "e.g. sales rep" },
    ],
  },
  {
    title: "Income",
    fields: [
      { name: "grossIncome", label: "Gross Salary", required: true, half: true, placeholder: "R30 000" },
      { name: "netSalary", label: "Nett Salary (take home)", required: true, half: true, placeholder: "R25 000" },
    ],
  },
  {
    title: "Monthly Expenses",
    fields: [
      { name: "expBondRent", label: "Bond / Rent", half: true, placeholder: "R0" },
      { name: "expVehicleFinance", label: "Vehicle Finance", half: true, placeholder: "R0" },
      { name: "expPersonalLoans", label: "Personal Loans", half: true, placeholder: "R0" },
      { name: "expCreditCards", label: "Credit Cards", half: true, placeholder: "R0" },
      { name: "expClothing", label: "Clothing / Furniture", half: true, placeholder: "R0" },
      { name: "expPetrol", label: "Petrol", half: true, placeholder: "R0" },
      { name: "expFood", label: "Food", half: true, placeholder: "R0" },
      { name: "expCellPhone", label: "Cell Phone", half: true, placeholder: "R0" },
      { name: "expInsurance", label: "Insurance", half: true, placeholder: "R0" },
    ],
  },
  {
    title: "Banking",
    fields: [
      { name: "bankName", label: "Bank Name", required: true, half: true, placeholder: "e.g. FNB, Nedbank" },
      { name: "accountNumber", label: "Account Number", half: true },
    ],
  },
  {
    title: "Reference & Deal",
    fields: [
      { name: "referenceName", label: "Reference: Name & Surname", required: true, placeholder: "Friend/family not living with you" },
      { name: "referencePhone", label: "Reference: Cell Number", type: "tel", required: true, half: true, placeholder: "000 000 0000" },
      { name: "vehicleOfInterest", label: "Vehicle of Interest", required: true, half: true, placeholder: "e.g. Toyota Fortuner" },
      { name: "tradeIn", label: "Trade-In?", type: "select", options: ["No", "Yes"], half: true },
      { name: "dealNotes", label: "Any notes on the deal or trade-in", type: "textarea", placeholder: "Optional" },
    ],
  },
];

export default function FinanceWizard({
  defaultVehicle = "",
  defaultStockSlug = "",
}: {
  defaultVehicle?: string;
  defaultStockSlug?: string;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({ vehicleOfInterest: defaultVehicle });
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const stepValid = useMemo(() => {
    return current.fields.every((f) => {
      const val = (data[f.name] ?? "").trim();
      if (f.required && val.length === 0) return false;
      if (val.length > 0 && f.pattern && !f.pattern.test(val)) return false;
      return true;
    });
  }, [current, data]);

  function set(name: string, value: string) {
    setData((d) => ({ ...d, [name]: value }));
  }

  async function submit() {
    if (!consent || status === "busy") return;
    setStatus("busy");
    const payload = {
      ...data,
      maritalStatus: data.maritalStatus || "",
      creditCheckConsent: "Yes",
      // Tag the application to the exact car when they came from a vehicle page
      // (lands in site_finance_applications.details.stock_slug for per-car attribution).
      ...(defaultStockSlug ? { stock_slug: defaultStockSlug } : {}),
      company,
    };
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
    } catch {
      // Fallback: send the key details via WhatsApp so the lead is never lost.
      setStatus("error");
      const msg = `Hi ${dealer.name}, I'd like to apply for finance.\nName: ${data.name ?? ""} ${data.surname ?? ""}\nPhone: ${data.phone ?? ""}\nVehicle: ${data.vehicleOfInterest ?? ""}\nNet salary: ${data.netSalary ?? ""}`;
      if (dealer.whatsapp && typeof window !== "undefined") {
        window.open(whatsappLink(msg), "_blank");
      }
    }
  }

  if (status === "done") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Check size={24} />
        </div>
        <h3 className="mt-4 text-xl font-bold">Application received</h3>
        <p className="mt-2 text-sm text-muted">
          Thanks {data.name}. Our finance team will be in touch shortly. For anything urgent, message us on WhatsApp.
        </p>
        {dealer.whatsapp && (
          <a href={whatsappLink(`Hi ${dealer.name}, I just submitted a finance application.`)} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold">
            Message us on WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{current.title}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {current.fields.map((f) => (
          <div key={f.name} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              {f.label}{f.required && <span className="text-accent"> *</span>}
            </label>
            {f.type === "select" ? (
              <select
                value={data[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                className="h-12 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
              >
                <option value="">Select...</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                value={data[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            ) : (
              <input
                type={f.type ?? "text"}
                inputMode={f.inputMode}
                maxLength={f.maxLength}
                value={data[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                className="h-12 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
              />
            )}
            {f.pattern && (data[f.name] ?? "").trim().length > 0 && !f.pattern.test((data[f.name] ?? "").trim()) && (
              <p className="mt-1 text-xs text-maroon">{f.hint ?? "Please check this field."}</p>
            )}
          </div>
        ))}
      </div>

      {/* Consent on the last step */}
      {isLast && (
        <label className="mt-5 flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e85d1f]" />
          <span>I consent to a credit check and to Dart Motors processing my information to assess this finance application.</span>
        </label>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-maroon">Something went wrong sending your application. We&apos;ve opened WhatsApp so you can send it directly.</p>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={!stepValid || !consent || status === "busy"}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {status === "busy" ? "Submitting..." : "Submit application"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => stepValid && setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!stepValid}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Continue <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
