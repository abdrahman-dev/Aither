import type { HeatmapTile } from "@aither/shared";

const METERS_PER_DEGREE_LATITUDE = 111_320;

export type TileValueLookup = {
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  ring: number[][];
  value: number | null;
};

function metersPerDegreeLongitude(latitude: number): number {
  return METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);
}

function ringOf(tile: HeatmapTile): number[][] {
  const polygon = tile.geometry;
  if (!polygon || polygon.type !== "Polygon") return [];
  return polygon.coordinates[0] ?? [];
}

function bboxOf(ring: number[][]): TileValueLookup["bbox"] {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lon = point[0];
    const lat = point[1];
    if (lon === undefined || lat === undefined) continue;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]?.[0] as number;
    const yi = ring[i]?.[1] as number;
    const xj = ring[j]?.[0] as number;
    const yj = ring[j]?.[1] as number;
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Precompute a fast lookup over heatmap tiles so route points can be sampled
 * repeatedly. Tile values that are null/unavailable are kept as null (never 0).
 */
export function buildTileLookup(
  tiles: HeatmapTile[],
  pickValue: (tile: HeatmapTile) => number | undefined
): TileValueLookup[] {
  return tiles.map((tile) => {
    const ring = ringOf(tile);
    const value = pickValue(tile);
    return {
      bbox: bboxOf(ring),
      ring,
      value: typeof value === "number" && Number.isFinite(value) ? value : null
    };
  });
}

export function sampleTiles(
  lookup: TileValueLookup[],
  points: Array<[number, number]>
): Array<number | null> {
  return points.map(([lon, lat]) => {
    for (const tile of lookup) {
      if (
        lon < tile.bbox.minLon ||
        lon > tile.bbox.maxLon ||
        lat < tile.bbox.minLat ||
        lat > tile.bbox.maxLat
      ) {
        continue;
      }
      if (pointInRing(lon, lat, tile.ring)) {
        return tile.value;
      }
    }
    // Point not covered by the heatmap: unavailable, not zero.
    return null;
  });
}

/** Resample a LineString so samples land roughly every spacingMeters along it. */
export function interpolateLine(
  coordinates: Array<[number, number]>,
  spacingMeters: number
): Array<[number, number]> {
  if (coordinates.length < 2) {
    return coordinates.slice();
  }
  const result: Array<[number, number]> = [];
  const spacing = Math.max(1, spacingMeters);

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i] as [number, number];
    const b = coordinates[i + 1] as [number, number];
    if (i === 0) result.push(a);

    const midLat = (a[1] + b[1]) / 2;
    const metersPerLon = metersPerDegreeLongitude(midLat);
    const dLonMeters = (b[0] - a[0]) * metersPerLon;
    const dLatMeters = (b[1] - a[1]) * METERS_PER_DEGREE_LATITUDE;
    const segmentLength = Math.sqrt(dLonMeters * dLonMeters + dLatMeters * dLatMeters);
    const steps = Math.max(1, Math.ceil(segmentLength / spacing));

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      result.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t
      ]);
    }
  }

  const last = coordinates[coordinates.length - 1] as [number, number];
  const tail = result[result.length - 1];
  if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) {
    result.push(last);
  }
  return result;
}

export type SampleAggregate = {
  // null when no valid sample was available along the route.
  value: number | null;
  validSamples: number;
  totalSamples: number;
};

export function maxOfSamples(samples: Array<number | null>): SampleAggregate {
  let max: number | null = null;
  let valid = 0;
  for (const sample of samples) {
    if (sample !== null) {
      valid += 1;
      if (max === null || sample > max) max = sample;
    }
  }
  return { value: max, validSamples: valid, totalSamples: samples.length };
}

export function meanOfSamples(samples: Array<number | null>): SampleAggregate {
  let sum = 0;
  let valid = 0;
  for (const sample of samples) {
    if (sample !== null) {
      sum += sample;
      valid += 1;
    }
  }
  return {
    value: valid === 0 ? null : sum / valid,
    validSamples: valid,
    totalSamples: samples.length
  };
}