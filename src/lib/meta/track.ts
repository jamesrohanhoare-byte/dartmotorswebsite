/**
 * Thin typed wrapper over window.fbq.
 *
 * Every component goes through this rather than touching window.fbq directly,
 * so that (a) a missing or blocked pixel is a silent no-op instead of a runtime
 * crash, and (b) there is exactly one place to look when an event is not
 * arriving in Events Manager.
 */

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/**
 * Standard Meta event with optional parameters. Safe to call before load.
 *
 * `eventId` is what lets the Conversions API report the SAME conversion without
 * it being double-counted. Pass the same id to both, or cost-per-lead reads at
 * half its real value.
 */
export function track(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (eventId) window.fbq("track", event, params, { eventID: eventId });
  else window.fbq("track", event, params);
}

/** A fresh id for one conversion, shared between the browser and the server. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Meta's own first-party cookies. Passing them to the Conversions API is the
 * single biggest lever on match quality for a visitor who never types an email,
 * because they identify the browser Meta already knows.
 */
export function metaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const read = (name: string) =>
    document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
  return { fbp: read("_fbp"), fbc: read("_fbc") };
}

/**
 * A vehicle-scoped event.
 *
 * content_type "vehicle" + content_ids is the pair that lets Meta join this
 * event to a row in the catalog. The id always comes from metaVehicleId — the
 * same function that writes vehicle_id into the feed — which is what guarantees
 * the join actually resolves.
 */
/**
 * Which on-page action produced a Lead. All three currently report as one `Lead`
 * because splitting them would leave each too sparse for Meta to learn from, but
 * they are NOT equal quality:
 *   form     — a confirmed lead; name/email/phone captured, chaseable either way
 *   whatsapp — intent only; plenty of people open the chat and never hit send
 *   email    — weakest; opens a mail client, most abandon there
 * Tagging them now means that in a month we can narrow the custom conversion to
 * whichever actually sells cars, with a rule change and no code. Without the
 * tag that comparison is impossible after the fact, because the data is gone.
 */
export type LeadChannel = "form" | "whatsapp" | "email";

export function trackVehicle(
  event: "ViewContent" | "Lead" | "Search" | "InitiateCheckout",
  vehicleId: string,
  extra?: {
    value?: number | null;
    name?: string;
    eventId?: string;
    leadChannel?: LeadChannel;
  },
): void {
  track(
    event,
    {
      content_type: "vehicle",
      content_ids: [vehicleId],
      currency: "ZAR",
      ...(extra?.value ? { value: extra.value } : {}),
      ...(extra?.name ? { content_name: extra.name } : {}),
      ...(extra?.leadChannel ? { lead_channel: extra.leadChannel } : {}),
    },
    extra?.eventId,
  );
}
