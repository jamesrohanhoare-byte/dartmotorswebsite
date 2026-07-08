"use client";

import { useState } from "react";

// "Subscribe to hear more" band (matches the dark strip on the current site).
export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "newsletter", contact: email, company, subject: "Newsletter signup" }),
      });
    } catch {
      /* non-critical */
    }
    setBusy(false);
    setDone(true);
  }

  return (
    <section className="border-t border-white/10 bg-[#1b1712] text-white">
      <div className="px-page mx-auto max-w-[1400px] py-14">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Subscribe to hear more</h2>
            <p className="mt-2 text-sm text-white/60">
              New stock, deals and finance offers, straight to your inbox.
            </p>
          </div>
          {done ? (
            <p className="text-sm text-white/80 md:justify-self-end">Thanks, you&apos;re on the list.</p>
          ) : (
            <form onSubmit={submit} className="flex gap-3 md:justify-self-end">
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
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="h-12 w-full min-w-0 rounded-lg border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-accent md:w-72"
              />
              <button type="submit" disabled={busy} className="btn-primary shrink-0 rounded-lg px-6 text-sm font-semibold disabled:opacity-60">
                {busy ? "..." : "Submit"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
