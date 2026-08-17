"use client";

import { useEffect } from "react";
import { trackVehicle, newEventId, metaCookies } from "@/lib/meta/track";

/**
 * Fires ViewContent for one vehicle, once per mount, on BOTH paths.
 *
 * Renders nothing. It exists as a client component only because the vehicle page
 * is a server component and cannot touch window. The vehicleId is computed on
 * the server with metaVehicleId — the SAME function the catalog feed uses — and
 * passed down, which is what guarantees this event joins to a real catalog row.
 *
 * This is the event that makes per-car retargeting possible. Without it, catalog
 * ads can only prospect to cold audiences, so it is worth mirroring server-side:
 * an ad blocker or iOS stripping the browser call would otherwise silently drop
 * that person out of the retargeting pool forever.
 *
 * ⚠️ One serverless invocation per vehicle page view. That is the cost of the
 * mirror and it is deliberate — a few thousand invocations a month is nothing
 * against the value of an intact retargeting audience. If traffic ever grows to
 * where it matters, sample it rather than removing it.
 */
export default function VehicleViewTracker({
  vehicleId,
  stockId,
  value,
  name,
}: {
  vehicleId: string;
  stockId: number;
  value: number | null;
  name: string;
}) {
  useEffect(() => {
    // One id for both paths so Meta merges them into a single ViewContent
    // rather than counting the page view twice.
    const eventId = newEventId();
    const { fbp, fbc } = metaCookies();

    trackVehicle("ViewContent", vehicleId, { value, name, eventId });

    void fetch("/api/meta-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "ViewContent",
        event_id: eventId,
        vehicle_id: stockId,
        vehicle_price: value ?? undefined,
        vehicle_title: name,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
        fbp,
        fbc,
      }),
    }).catch(() => {});
  }, [vehicleId, stockId, value, name]);

  return null;
}
