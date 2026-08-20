import type { Coordinates } from "@aither/shared";
import type { PolygonAoi } from "../services/fortyguard/types";

export const EARLIEST_SUPPORTED_DATE = "2021-01-01";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const latitude = (value as Coordinates).latitude;
  const longitude = (value as Coordinates).longitude;
  return (
    isFiniteNumber(latitude) &&
    isFiniteNumber(longitude) &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  );
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export function todayAsDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The canonical contract supports 2021-01-01 through today only (AGENTS.md §17).
export function isSupportedDate(value: unknown): value is string {
  if (!isValidDateString(value)) return false;
  return value >= EARLIEST_SUPPORTED_DATE && value <= todayAsDateString();
}

export function isValidTimeString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isValidPolygonRing(ring: unknown): boolean {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  if (
    !ring.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        isFiniteNumber(point[0]) &&
        isValidLongitude(point[0]) &&
        isFiniteNumber(point[1]) &&
        isValidLatitude(point[1])
    )
  ) {
    return false;
  }
  const first = ring[0] as [number, number];
  const last = ring[ring.length - 1] as [number, number];
  // GeoJSON polygon rings are closed: first point equals last point.
  return first[0] === last[0] && first[1] === last[1];
}

export function isPolygonAoi(value: unknown): value is PolygonAoi {
  if (typeof value !== "object" || value === null) return false;
  const aoi = value as PolygonAoi;
  if (aoi.type !== "FeatureCollection" || !Array.isArray(aoi.features) || aoi.features.length === 0) {
    return false;
  }
  return aoi.features.every((feature) => {
    if (!feature || feature.type !== "Feature") return false;
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
      return false;
    }
    return isValidPolygonRing(geometry.coordinates[0]);
  });
}