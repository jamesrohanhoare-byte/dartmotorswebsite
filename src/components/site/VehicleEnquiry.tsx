"use client";

import { MessageCircle, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dealer, whatsappLink, emailLink } from "@/config/dealer";
import { trackVehicle, newEventId, metaCookies } from "@/lib/meta/track";

// Per-car enquiry buttons. WhatsApp is the PRIMARY channel (Dart sells via
// WhatsApp). Each click also logs the lead to site_leads (anon insert, RLS-safe).
export default function VehicleEnquiry({
  stockSlug,
  title,
  message,
  emailSubject,
  vehicleId,
  price,
  stockId,
}: {
  stockSlug: string;
  title: string;
  message: string;
  emailSubject: string;
  vehicleId: string; // Meta catalog id — matches the feed by construction
  price: number | null;
  stockId: number; // numeric form of vehicleId, for the server-side event
}) {
  function log(channel: "whatsapp" | "email") {
    // Mirror the click to Meta as a Lead. A WhatsApp click IS the conversion on
    // this site — it is where Dart's sale actually starts — so this is the event
    // the catalog campaign should be optimising toward, not the pageview.
    //
    // One id for both paths so Meta deduplicates rather than double-counting.
    // This visitor is anonymous (no form filled), so the server side has only
    // Meta's cookies + IP to match on, which is exactly what /api/meta-event
    // exists to forward.
    const eventId = newEventId();
    const { fbp, fbc } = metaCookies();
    // `Contact`, not `Lead` — Meta blocks Lead under the Sales objective that
    // catalogue campaigns require. See the note in lib/meta/track.ts.
    trackVehicle("Contact", vehicleId, { value: price, name: title, eventId, leadChannel: channel });
    void fetch("/api/meta-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true, // the click navigates away; without this the request dies
      body: JSON.stringify({
        event_name: "Contact",
        event_id: eventId,
        vehicle_id: stockId,
        vehicle_price: price ?? undefined,
        vehicle_title: title,
        lead_channel: channel,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
        fbp,
        fbc,
      }),
    }).catch(() => {});

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
