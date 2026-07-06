"use client";

import { useState } from "react";
import { MessageCircle, Check, Heart } from "lucide-react";
import { dealer, whatsappLink } from "@/config/dealer";

// PRIMARY per-car CTA: capture the visitor's details FIRST (name/email/phone),
// logged to site_leads tagged to this exact car (channel "interested"), THEN hand
// them to WhatsApp as the warm follow-up. So every interested visitor becomes a
// tracked per-car lead in the software even if they never open WhatsApp.
export default function VehicleInterest({
  stockSlug,
  title,
  message,
}: {
  stockSlug: string;
  title: string;
  message: string; // pre-filled WhatsApp message for this vehicle
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "busy") return;
    setStatus("busy");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "interested",
          stock_slug: stockSlug,
          name: form.name,
          contact: form.email, // email is the primary contact (drives email reply-to)
          phone: form.phone,
          message: title, // which car they're interested in
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
          company,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Never lose the lead: fall back to WhatsApp with their details pre-filled.
      if (dealer.whatsapp && typeof window !== "undefined") {
        window.open(
          whatsappLink(`Hi ${dealer.name}, I'm interested in the ${title}. (${form.name}, ${form.email}, ${form.phone})`),
          "_blank",
        );
      }
    }
    setStatus("done"); // either way, thank them + nudge to WhatsApp
  }

  // Success: confirm capture, then push WhatsApp as the warm follow-up.
  if (status === "done") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Check size={22} />
        </div>
        <h3 className="mt-3 text-base font-bold">Great{form.name ? `, ${form.name.split(" ")[0]}` : ""} — we&apos;ve got your details</h3>
        <p className="mt-1 text-sm text-muted">
          Our team will be in touch about the {title}. For the fastest reply, pop us a message on WhatsApp too.
        </p>
        {dealer.whatsapp && (
          <a
            href={whatsappLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
          >
            <MessageCircle size={18} /> Message us on WhatsApp
          </a>
        )}
      </div>
    );
  }

  // Collapsed: the primary CTA button.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
      >
        <Heart size={18} /> I&apos;m interested in this car
      </button>
    );
  }

  // Expanded: the capture form.
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold">Leave your details and we&apos;ll be in touch</p>
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <input
        required
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
      />
      <input
        required
        type="email"
        value={form.email}
        onChange={(e) => set("email", e.target.value)}
        placeholder="Email"
        autoComplete="email"
        className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
      />
      <input
        required
        type="tel"
        value={form.phone}
        onChange={(e) => set("phone", e.target.value)}
        placeholder="Phone number"
        autoComplete="tel"
        className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "busy"}
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold disabled:opacity-60"
      >
        {status === "busy" ? "Sending..." : "Send my details"}
      </button>
    </form>
  );
}
