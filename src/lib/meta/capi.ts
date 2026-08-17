import { createHash } from "crypto";
import { metaVehicleId } from "./vehicleId";
import type { SiteStock } from "@/lib/types";

/**
 * Meta Conversions API (server-side events).
 *
 * Ported from the proven Impact Volunteers implementation and adapted for a
 * dealership. Recovers the conversions that iOS privacy settings and ad blockers
 * strip from the browser pixel — typically a fifth to a third of them.
 *
 * Server-only by construction: reads META_CAPI_TOKEN, an UNPREFIXED env var, so
 * it can never be bundled into client JavaScript. Never import this from a
 * "use client" component.
 *
 * Fully optional. With no META_CAPI_TOKEN set, every call is a silent no-op and
 * the browser pixel carries on alone.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ EVENT DEDUPLICATION — THE THING THAT MATTERS MOST
 *
 * The browser and this module BOTH report the same conversion. Meta merges them
 * only when they share an `event_id` AND an `event_name`. Get that wrong and
 * every lead is counted twice, which halves your apparent cost per lead and
 * makes a bad campaign look good. That is worse than no tracking at all.
 *
 * So the event id is generated ONCE on the client, passed to fbq as `eventID`,
 * and sent here in the same request. It is never generated server-side.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ POPIA: this takes an explicit, CLOSED set of identity fields rather than a
 * bag of form data. dartmotors.net/financing collects idNumber, dob, bank
 * account and income — special personal information that must NEVER reach an
 * advertising platform, hashed or not. There is deliberately no code path here
 * that forwards an arbitrary object, so a future edit cannot leak a new field.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = "v21.0";

/** The ONLY personal fields permitted to leave this system. */
export type CapiIdentity = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

export type CapiEvent = {
  eventName: "Lead" | "ViewContent";
  /** MUST match the browser event's id, or Meta counts the conversion twice. */
  eventId: string;
  eventSourceUrl?: string;
  identity?: CapiIdentity;
  /** Vehicle the event is about — drives content_ids, which joins to the catalog. */
  vehicle?: Pick<SiteStock, "stock_id"> & { price?: number | null; title?: string | null };
  /** form | whatsapp | email — must mirror the browser event's lead_channel. */
  leadChannel?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Meta's own browser cookies. These materially improve match quality. */
  fbc?: string;
  fbp?: string;
};

/** Meta requires SHA-256 of the trimmed, lowercased value. */
function hash(value?: string): string | undefined {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  return createHash("sha256").update(normalised).digest("hex");
}

/** Phone numbers must be digits only, with country code, before hashing. */
function hashPhone(value?: string): string | undefined {
  if (!value) return undefined;
  let digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  // Local SA format (082…) to E.164 digits (2782…) — same normalisation the
  // WhatsApp links use. Without it, the hash never matches a Meta profile.
  if (digits.startsWith("0")) digits = `27${digits.slice(1)}`;
  return createHash("sha256").update(digits).digest("hex");
}

function buildUserData(e: CapiEvent): Record<string, unknown> {
  const ud: Record<string, unknown> = {};
  const em = hash(e.identity?.email);
  const ph = hashPhone(e.identity?.phone);
  const fn = hash(e.identity?.firstName);
  const ln = hash(e.identity?.lastName);
  if (em) ud.em = [em];
  if (ph) ud.ph = [ph];
  if (fn) ud.fn = [fn];
  if (ln) ud.ln = [ln];
  // Dart is a single-branch Cape Town dealer, so city/state/country would be the
  // same constant on every row. Meta treats a constant as noise, not signal, so
  // they are deliberately omitted rather than padded in.
  if (e.clientIpAddress) ud.client_ip_address = e.clientIpAddress;
  if (e.clientUserAgent) ud.client_user_agent = e.clientUserAgent;
  if (e.fbc) ud.fbc = e.fbc;
  if (e.fbp) ud.fbp = e.fbp;
  return ud;
}

/**
 * Meta rejects an event outright when it carries no usable identifiers
 * ("insufficient customer information"). Anonymous events — a WhatsApp click by
 * someone who never filled the form — only have the cookies and the IP, so we
 * check up front rather than firing a request we know will bounce.
 */
function hasUsableIdentity(ud: Record<string, unknown>): boolean {
  return Boolean(ud.em || ud.ph || ud.fbp || ud.fbc || ud.client_ip_address);
}

/**
 * Send one server-side event.
 *
 * NEVER throws. A tracking failure must not be able to break an enquiry — the
 * lead is the business, the analytics are not.
 */
export async function sendCapiEvent(e: CapiEvent): Promise<boolean> {
  // Logged, not silent. A disabled tracking integration looks identical to a
  // working one from the outside, so without this line the only way to discover
  // a missing token is to notice conversions are down weeks later.
  if (!PIXEL_ID || !TOKEN) {
    console.warn(
      `[capi] DISABLED — ${!PIXEL_ID ? "NEXT_PUBLIC_META_PIXEL_ID" : "META_CAPI_TOKEN"} is not set. ` +
        `Event "${e.eventName}" was not sent server-side.`,
    );
    return false;
  }

  const userData = buildUserData(e);
  if (!hasUsableIdentity(userData)) {
    console.warn(`[capi] skipped "${e.eventName}": no usable identifiers (Meta would reject it)`);
    return false;
  }

  const customData: Record<string, unknown> = {};
  // Mirrors the browser event so the merged conversion carries the same
  // attribution either way — otherwise which channel a lead came from would
  // depend on which of the two paths happened to survive.
  if (e.leadChannel) customData.lead_channel = e.leadChannel;
  if (e.vehicle) {
    // Same id the catalog feed writes as vehicle_id — see meta/vehicleId.ts.
    customData.content_type = "vehicle";
    customData.content_ids = [metaVehicleId(e.vehicle)];
    customData.currency = "ZAR";
    if (e.vehicle.price) customData.value = e.vehicle.price;
    if (e.vehicle.title) customData.content_name = e.vehicle.title;
  }

  const payload = {
    data: [
      {
        event_name: e.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: "website",
        ...(e.eventSourceUrl ? { event_source_url: e.eventSourceUrl } : {}),
        user_data: userData,
        ...(Object.keys(customData).length ? { custom_data: customData } : {}),
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error("[capi] error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[capi] request failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Split a single "Full Name" field into the first/last Meta wants. */
export function splitName(full?: string): { firstName?: string; lastName?: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

/**
 * Best-effort real client IP behind Vercel's proxy.
 * `x-forwarded-for` is a comma-separated chain; the first entry is the client.
 */
export function clientIpFrom(headers: Headers): string | undefined {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return headers.get("x-real-ip") ?? undefined;
}
