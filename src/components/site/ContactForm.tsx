"use client";

import { useState } from "react";
import { dealer, whatsappLink } from "@/config/dealer";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "busy") return;
    setStatus("busy");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "form", ...form, company }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      if (dealer.whatsapp) {
        window.open(whatsappLink(`Hi ${dealer.name}, ${form.message || "I have an enquiry"}. (${form.name}, ${form.contact})`), "_blank");
      }
      setStatus("done");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Thanks {form.name || "there"}, we&apos;ve got your message and will be in touch shortly.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-accent" />
        <input required value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Phone or email" className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-accent" />
      </div>
      <textarea required value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="How can we help? Mention a car if you have one in mind." rows={4} className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent" />
      <button type="submit" disabled={status === "busy"} className="btn-primary w-full rounded-full px-6 py-3.5 text-sm font-semibold disabled:opacity-60">
        {status === "busy" ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
