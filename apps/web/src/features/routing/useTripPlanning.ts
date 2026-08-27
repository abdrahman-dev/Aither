import { useState } from "react";
import type { Coordinates, RouteRiskData } from "@aither/shared";

export type PickTarget = "origin" | "destination";

export type RouteProfile = "foot-walking" | "driving-car" | "cycling-regular";

/** One-shot device position fix; heading in degrees or null when unknown. */
export type CurrentLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
};

export type LocationStatus = "idle" | "locating" | "denied" | "unavailable";

/** Trip context shown with the results so the numbers stay attributable. */
export type ResultContext = {
  date: string;
  windowLabel: string;
  modeLabel: string;
};

/**
 * Shared trip-planning state owned by App and consumed by BaseMap (map clicks,
 * markers, route rendering) and RoutePlanner (picker buttons, submit).
 * Kept as plain React state  no store library for one feature slice.
 */
export function useTripPlanning() {
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [pickingTarget, setPickingTarget] = useState<PickTarget | null>(null);
  const [result, setResult] = useState<RouteRiskData | null>(null);
  const [resultContext, setResultContext] = useState<ResultContext | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");

  /** Arm a picker; clicking the active button again cancels. */
  function togglePick(target: PickTarget): void {
    setPickingTarget((current) => (current === target ? null : target));
  }

  /**
   * Called for every map click; only mutates state while a picker is armed so
   * plain map exploration never changes the trip.
   */
  function handleMapClick(coords: Coordinates): void {
    if (pickingTarget === "origin") {
      setOrigin(coords);
      setPickingTarget(null);
    } else if (pickingTarget === "destination") {
      setDestination(coords);
      setPickingTarget(null);
    }
  }

  function publishResult(data: RouteRiskData, context: ResultContext): void {
    setResult(data);
    setResultContext(context);
  }

  function clearResult(): void {
    setResult(null);
    setResultContext(null);
  }

  // D4-adjacent UX helper: one-shot device fix (never watchPosition/tracking).
  // Success also adopts the fix as the origin so "use my location" is a real
  // shortcut, and the blue dot keeps showing where the user actually stands.
  function fetchCurrentLocation(): void {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        setCurrentLocation({
          latitude,
          longitude,
          heading: typeof heading === "number" && !Number.isNaN(heading) ? heading : null
        });
        setOrigin({ latitude, longitude });
        setPickingTarget(null);
        setLocationStatus("idle");
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return {
    origin,
    destination,
    pickingTarget,
    result,
    resultContext,
    currentLocation,
    locationStatus,
    togglePick,
    handleMapClick,
    publishResult,
    clearResult,
    fetchCurrentLocation
  };
}
