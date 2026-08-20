import type { PolygonAoi } from "../fortyguard/types";
import { RoutingError } from "../routing/errors";

// Basic plan cap, 10 mi² (AGENTS.md §9.2, D2). Premium is 50 mi² (not reachable
// from a fixed-size padded route box in practice without explicit overrides).
export const BASIC_PLAN_AREA_METERS_SQUARED = 10 * 1609.344 * 1609.344;
const METERS_PER_DEGREE_LATITUDE = 111_320;

export type SharedHull = {
  aoi: PolygonAoi;
  areaMetersSquared: number;
  padded: boolean;
  clampedToCap: boolean;
  exceedsCap: boolean;
};

export type BuildHullOptions = {
  paddingMeters?: number;
  maxAreaMetersSquared?: number;
};

function metersPerDegreeLongitude(latitude: number): number {
  return METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);
}

/**
 * D2: one shared hull covering all routes being compared, used as the single
 * polygon_aoi for one heatmap request. A padded bounding box (not a tight hull)
 * is enough. Padding is clamped so the box stays within the plan cap; if even
 * the unpadded box would exceed the cap the box is returned anyway — the hull
 * makes requests efficient, it is not a strict area refusal.
 */
export function buildSharedHull(
  routeCoordinateSets: number[][][],
  options: BuildHullOptions = {}
): SharedHull {
  const padding = options.paddingMeters ?? 150;
  const maxArea = options.maxAreaMetersSquared ?? BASIC_PLAN_AREA_METERS_SQUARED;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const coords of routeCoordinateSets) {
    for (const point of coords) {
      if (!Array.isArray(point) || point.length < 2) {
        throw new RoutingError("Cannot build a shared hull: found an invalid coordinate.");
      }
      const lon = point[0];
      const lat = point[1];
      if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat)) {
        throw new RoutingError("Cannot build a shared hull: found an invalid coordinate.");
      }
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat)
  ) {
    throw new RoutingError("Cannot build a shared hull without coordinates.");
  }

  const midLat = (minLat + maxLat) / 2;
  const metersPerLon = metersPerDegreeLongitude(midLat);
  const widthMeters = (maxLon - minLon) * metersPerLon;
  const heightMeters = (maxLat - minLat) * METERS_PER_DEGREE_LATITUDE;
  const rawArea = widthMeters * heightMeters;
  const exceedsCap = rawArea > maxArea;

  let padMeters = padding;
  let clampedToCap = false;
  if (!exceedsCap) {
    const maxPad =
      (-(widthMeters + heightMeters) +
        Math.sqrt((widthMeters + heightMeters) ** 2 - 4 * (rawArea - maxArea))) /
      2;
    if (padMeters > maxPad) {
      padMeters = Math.max(0, maxPad);
      clampedToCap = true;
    }
  } else {
    padMeters = 0;
  }

  const padLon = padMeters / metersPerLon;
  const padLat = padMeters / METERS_PER_DEGREE_LATITUDE;
  const west = minLon - padLon;
  const east = maxLon + padLon;
  const south = minLat - padLat;
  const north = maxLat + padLat;

  const ring = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south]
  ];

  const areaMetersSquared =
    (east - west) * metersPerLon * (north - south) * METERS_PER_DEGREE_LATITUDE;

  if (exceedsCap) {
    console.log(
      `Route comparison hull exceeds the ${Math.round(maxArea)} m² plan cap; using the unpadded box.`
    );
  }

  return {
    padded: padMeters > 0,
    clampedToCap,
    exceedsCap,
    areaMetersSquared,
    aoi: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [ring] }
        }
      ]
    }
  };
}