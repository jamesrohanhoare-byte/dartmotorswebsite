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

/** Standard Meta event with optional parameters. Safe to call before load. */
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}

/**
 * A vehicle-scoped event.
 *
 * content_type "vehicle" + content_ids is the pair that lets Meta join this
 * event to a row in the catalog. The id always comes from metaVehicleId — the
 * same function that writes vehicle_id into the feed — which is what guarantees
 * the join actually resolves.
 */
export function trackVehicle(
  event: "ViewContent" | "Lead" | "Search" | "InitiateCheckout",
  vehicleId: string,
  extra?: { value?: number | null; name?: string },
): void {
  track(event, {
    content_type: "vehicle",
    content_ids: [vehicleId],
    currency: "ZAR",
    ...(extra?.value ? { value: extra.value } : {}),
    ...(extra?.name ? { content_name: extra.name } : {}),
  });
}
