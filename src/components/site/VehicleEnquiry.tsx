"use client";

import { MessageCircle, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dealer, whatsappLink, emailLink } from "@/config/dealer";

// Per-car enquiry buttons. WhatsApp is the PRIMARY channel (Dart sells via
// WhatsApp). Each click also logs the lead to site_leads (anon insert, RLS-safe).
export default function VehicleEnquiry({
  stockSlug,
  title,
  message,
  emailSubject,
}: {
  stockSlug: string;
  title: string;
  message: string;
  emailSubject: string;
}) {
  function log(channel: "whatsapp" | "email") {
    // Fire-and-forget; the link opens normally regardless. NOTE: a supabase
    // query is a LAZY thenable — the request is only sent inside .then().
    // `void ...` sent nothing, so these clicks were never logged.
    const supabase = createClient();
    supabase
      .from("site_leads")
      .insert({
        stock_slug: stockSlug,
        channel,
        message: title,
        meta: { page: typeof window !== "undefined" ? window.location.pathname : null },
      })
      .then(
        () => {},
        () => {},
      );
  }

  return (
    <div className="space-y-3">
      {dealer.whatsapp && (
        <a
          href={whatsappLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => log("whatsapp")}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
        >
          <MessageCircle size={18} /> Enquire on WhatsApp
        </a>
      )}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={emailLink(emailSubject, message)}
          onClick={() => log("email")}
          className="flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-3.5 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <Mail size={16} /> Email
        </a>
        <a
          href={`tel:${dealer.phoneTel}`}
          className="flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-3.5 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <Phone size={16} /> Call
        </a>
      </div>
    </div>
  );
}
