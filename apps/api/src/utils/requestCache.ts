import type { HeatmapResult, RouteRiskData, RoutesData } from "@aither/shared";
import { TtlCache } from "./cache";

// In-memory only, no persistence (Phase 0.5 stateless decision). Prevents
// duplicate-cost FortyGuard/ORS calls for identical repeated requests within
// the process lifetime. TTLs are short so the live-data product never serves
// meaningfully stale data (D4): 5 min for single-source lookups, 10 min for
// route-risk because one computation triggers three heatmap activities.
export const HEATMAP_CACHE_TTL_MS = 5 * 60_000;
export const ROUTE_CACHE_TTL_MS = 5 * 60_000;
export const ROUTE_RISK_CACHE_TTL_MS = 10 * 60_000;

export const heatmapCache = new TtlCache<HeatmapResult>(HEATMAP_CACHE_TTL_MS);
export const routeCache = new TtlCache<RoutesData>(ROUTE_CACHE_TTL_MS);
export const routeRiskCache = new TtlCache<RouteRiskData>(ROUTE_RISK_CACHE_TTL_MS);

// Round to 6 decimal places (~0.1 m) so near-identical requests still hit.
export function roundCoordinate(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

// Round every finite number in a value (used for AOI geometries).
export function roundNumbersDeep(value: unknown, digits = 6): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundCoordinate(value, digits);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => roundNumbersDeep(entry, digits));
  }
  if (typeof value === "object" && value !== null) {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = roundNumbersDeep(entry, digits);
    }
    return output;
  }
  return value;
}

type LatLng = { latitude: number; longitude: number };

function canonLatLng(value: LatLng): { latitude: number; longitude: number } {
  return {
    latitude: roundCoordinate(value.latitude),
    longitude: roundCoordinate(value.longitude)
  };
}

export function heatmapCacheKey(input: {
  aoi: unknown;
  startDate: string;
  filterType: number;
  startTime?: string;
  endTime?: string;
  endDate?: string;
  granularity?: number;
  analyticType?: string;
  threshold?: number;
  direction?: string;
}): string {
  return JSON.stringify({
    v: 1,
    kind: "heatmap",
    aoi: roundNumbersDeep(input.aoi),
    startDate: input.startDate,
    filterType: input.filterType,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    endDate: input.endDate ?? null,
    granularity: input.granularity ?? 100,
    analyticType: input.analyticType ?? "tcm",
    threshold: input.threshold ?? null,
    direction: input.direction ?? null
  });
}

export function routeCacheKey(input: {
  origin: LatLng;
  destination: LatLng;
  profile: string;
}): string {
  return JSON.stringify({
    v: 1,
    kind: "route",
    origin: canonLatLng(input.origin),
    destination: canonLatLng(input.destination),
    profile: input.profile
  });
}

export function routeRiskCacheKey(input: {
  origin: LatLng;
  destination: LatLng;
  date: string;
  startTime?: string;
  endTime?: string;
  threshold?: number;
  direction?: string;
  profile?: string;
  granularity?: number;
}): string {
  return JSON.stringify({
    v: 1,
    kind: "route-risk",
    origin: canonLatLng(input.origin),
    destination: canonLatLng(input.destination),
    date: input.date,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    threshold: input.threshold ?? null,
    direction: input.direction ?? null,
    profile: input.profile ?? "foot-walking",
    granularity: input.granularity ?? 100
  });
}