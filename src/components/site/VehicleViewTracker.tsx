"use client";

import { useEffect } from "react";
import { trackVehicle } from "@/lib/meta/track";

/**
 * Fires ViewContent for one vehicle, once per mount.
 *
 * Renders nothing. It exists as a client component only because the vehicle page
 * is a server component and cannot touch window. The vehicleId is computed on
 * the server with metaVehicleId — the SAME function the catalog feed uses — and
 * passed down, which is what guarantees this event joins to a real catalog row.
 *
 * This is the event that makes per-car retargeting possible. Without it, catalog
 * ads can only prospect to cold audiences.
 */
export default function VehicleViewTracker({
  vehicleId,
  value,
  name,
}: {
  vehicleId: string;
  value: number | null;
  name: string;
}) {
  useEffect(() => {
    trackVehicle("ViewContent", vehicleId, { value, name });
  }, [vehicleId, value, name]);

  return null;
}
