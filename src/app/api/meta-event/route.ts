import { sendCapiEvent, clientIpFrom } from "@/lib/meta/capi";
import { dealer } from "@/config/dealer";

/**
 * Server-side mirror for ANONYMOUS conversions — the WhatsApp and Email buttons
 * on a vehicle page.
 *
 * Those clicks are real conversions (a WhatsApp message IS how Dart sells a car)
 * but they carry no name, email or phone, so they cannot go through /api/lead.
 * This route exists purely to forward them to the Conversions API using Meta's
 * own cookies plus the IP and user agent, which is enough for a match.
 *
 * ⚠️ Deliberately writes NOTHING to the database. VehicleEnquiry already logs
 * the click to site_leads directly from the client, and duplicating that here
 * would double-count every enquiry in Dart's own reporting. This route is
 * tracking only.
 *
 * Not authenticated, by design: it can only ever emit a Meta event, it stores
 * nothing, and it reads no data. The worst a bad actor achieves is polluting an
 * ad dataset, which is the same exposure the public browser pixel already has.
 */

export const runtime = "nodejs";

type Payload = {
  event_name?: string;
  event_id?: string;
  vehicle_id?: number;
  vehicle_price?: number;
  vehicle_title?: string;
  lead_channel?: string;
  page?: string;
  fbp?: string;
  fbc?: string;
};

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Closed allowlist. Without it this becomes an open relay for arbitrary event
  // names into Dart's dataset.
  // `Contact`, not `Lead` — Meta blocks Lead under the Sales objective that
  // catalogue campaigns require. See lib/meta/track.ts.
  const eventName = body.event_name === "Contact" ? "Contact" : null;
  if (!eventName || !body.event_id) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  await sendCapiEvent({
    eventName,
    eventId: body.event_id,
    eventSourceUrl: body.page ? `${dealer.siteUrl}${body.page}` : dealer.siteUrl,
    vehicle: body.vehicle_id
      ? {
          stock_id: body.vehicle_id,
          price: body.vehicle_price ?? null,
          title: body.vehicle_title ?? null,
        }
      : undefined,
    // Closed allowlist here too: this route is public, so an arbitrary string
    // would let anyone write junk attribution into Dart's dataset.
    leadChannel: ["whatsapp", "email", "form"].includes(body.lead_channel ?? "")
      ? body.lead_channel
      : undefined,
    clientIpAddress: clientIpFrom(req.headers),
    clientUserAgent: req.headers.get("user-agent") ?? undefined,
    fbp: body.fbp,
    fbc: body.fbc,
  });

  return Response.json({ ok: true });
}
