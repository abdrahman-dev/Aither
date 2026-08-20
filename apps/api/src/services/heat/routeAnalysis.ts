import type { HeatRiskLevel, Coordinates } from "@aither/shared";
import { fortyGuardClient } from "../fortyguard";
import {
  createHeatmap,
  FortyGuardError,
  HEATMAP_GRANULARITIES,
  type ExceedanceDirection,
  type HeatmapDateRequest,
  type HeatmapGranularity
} from "../fortyguard";
import type { NormalizedRoute, RouteSummary, LineStringGeometry } from "../routing";
import { orsClient } from "../routing";
import { buildSharedHull, type SharedHull } from "./hull";
import {
  buildTileLookup,
  interpolateLine,
  sampleTiles,
  maxOfSamples,
  meanOfSamples
} from "./sampling";
import { classifyRiskScore, normalizeRelative, segmentRiskScore } from "../risk";
import { HttpError } from "../../utils/http";
import {
  isFiniteNumber,
  isSupportedDate,
  isValidCoordinates,
  isValidTimeString
} from "../../utils/validate";

const DEFAULT_THRESHOLD_C = 30; // °C — the API's documented default
const DEFAULT_DIRECTION = "above" as ExceedanceDirection;

export type RouteHeatAnalysis = {
  peakTemperatureC: number;
  exceedanceHours: number;
  persistenceHours: number;
  validSamples: number;
  totalSamples: number;
};

export type RiskAssessment = {
  score: number;
  level: HeatRiskLevel;
  terms: {
    normalizedPeakTemperature: number;
    normalizedExceedance: number;
    normalizedPersistence: number;
  };
};

export type AnalyzedRoute = {
  routeId: string;
  geometry: LineStringGeometry;
  summary: RouteSummary;
  heat: RouteHeatAnalysis | null;
  risk: RiskAssessment | null;
};

export type RouteTradeoff = {
  recommendedVsFastest: {
    extraMinutes: number;
    extraDistanceMeters: number;
    heatExposureReductionPercent: number | null;
  };
};

export type CompareRouteResult = {
  routes: AnalyzedRoute[];
  hull: SharedHull;
  analyses: ["tcm", "exceedance", "persistence"];
  threshold: number;
  direction: ExceedanceDirection;
  timeWindow: { startTime: string | null; endTime: string | null };
  recommendation: { routeId: string; basis: string } | null;
  tradeoff: RouteTradeoff | null;
  warnings: string[];
};

export type AnalyzeRouteRiskInput = {
  origin: Coordinates;
  destination: Coordinates;
  date: string;
  startTime?: string;
  endTime?: string;
  threshold?: number;
  direction?: ExceedanceDirection;
  profile?: string;
  granularity?: HeatmapGranularity;
};

/**
 * Parse + validate the /api/route-risk request body into canonical fields.
 * Exported so the route handler can derive the cache key from the same
 * canonical values the analyzer uses (defaults applied consistently).
 */
export function parseRouteRiskInput(input: unknown): Required<
  Pick<
    AnalyzeRouteRiskInput,
    "origin" | "destination" | "date" | "threshold" | "direction" | "profile" | "granularity"
  >
> & { startTime: string; endTime: string } {
  if (typeof input !== "object" || input === null) {
    throw new HttpError(400, "Invalid request body.");
  }
  const body = input as Record<string, unknown>;

  if (!isValidCoordinates(body.origin)) {
    throw new HttpError(400, "origin must be { latitude, longitude }.");
  }
  if (!isValidCoordinates(body.destination)) {
    throw new HttpError(400, "destination must be { latitude, longitude }.");
  }
  const origin = body.origin as Coordinates;
  const destination = body.destination as Coordinates;
  if (origin.latitude === destination.latitude && origin.longitude === destination.longitude) {
    throw new HttpError(400, "origin and destination must be different.");
  }

  if (!isSupportedDate(body.date)) {
    throw new HttpError(
      400,
      "date must be YYYY-MM-DD between 2021-01-01 and today (forecast dates are not supported)."
    );
  }

  let startTime: string | null = null;
  let endTime: string | null = null;
  if (body.startTime !== undefined) {
    if (!isValidTimeString(body.startTime)) {
      throw new HttpError(400, "startTime must be HH:MM (00:00–23:59).");
    }
    startTime = body.startTime;
  }
  if (body.endTime !== undefined) {
    if (!isValidTimeString(body.endTime)) {
      throw new HttpError(400, "endTime must be HH:MM (00:00–23:59).");
    }
    endTime = body.endTime;
  }

  let threshold = DEFAULT_THRESHOLD_C;
  if (body.threshold !== undefined) {
    if (!isFiniteNumber(body.threshold)) {
      throw new HttpError(400, "threshold must be a number (°C).");
    }
    threshold = body.threshold;
  }

  let direction = DEFAULT_DIRECTION;
  if (body.direction !== undefined) {
    if (body.direction !== "above" && body.direction !== "below") {
      throw new HttpError(400, "direction must be 'above' or 'below'.");
    }
    direction = body.direction;
  }

  let granularity: HeatmapGranularity = 100;
  if (body.granularity !== undefined) {
    if (!HEATMAP_GRANULARITIES.includes(body.granularity as HeatmapGranularity)) {
      throw new HttpError(400, "granularity must be 60, 80 or 100 meters.");
    }
    granularity = body.granularity as HeatmapGranularity;
  }

  const startTimeValue = startTime ?? "00:00";
  const endTimeValue = endTime ?? "23:00";
  if (endTimeValue < startTimeValue) {
    throw new HttpError(400, "endTime must not be before startTime.");
  }

  return {
    origin,
    destination,
    date: body.date as string,
    startTime: startTimeValue,
    endTime: endTimeValue,
    threshold,
    direction,
    profile: typeof body.profile === "string" && body.profile.trim() !== "" ? body.profile : "foot-walking",
    granularity
  };
}

function routesEquivalent(a: NormalizedRoute, b: NormalizedRoute): boolean {
  return Math.round(a.summary.distanceMeters) === Math.round(b.summary.distanceMeters);
}

/**
 * End-to-end route heat comparison (Phase 2 wiring):
 *  ORS routes → shared hull → tcm + exceedance + persistence heatmaps over one
 *  AOI (D2) → per-route sampling → D1 risk scores normalized across routes.
 */
export async function analyzeRouteRisk(input: unknown): Promise<CompareRouteResult> {
  const parsed = parseRouteRiskInput(input);
  const { origin, destination, date, startTime, endTime, threshold, direction, profile, granularity } = parsed;

  const coordinates: Array<[number, number]> = [
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude]
  ];

  // At least two route options to compare: fastest plus alternatives in one
  // call; fall back to a separate shortest call when the API returns only one.
  const directionResult = await orsClient.directions(coordinates, {
    profile,
    preference: "fastest"
  });
  const warnings = [...directionResult.warnings];
  const routes = [...directionResult.routes];

  if (routes.length < 2) {
    const shortestResult = await orsClient.directions(coordinates, {
      profile,
      preference: "shortest",
      alternativeRoutes: false
    });
    for (const candidate of shortestResult.routes) {
      if (!routes.some((existing) => routesEquivalent(existing, candidate))) {
        routes.push(candidate);
      }
    }
    for (const extra of shortestResult.warnings) {
      if (!warnings.includes(extra)) warnings.push(extra);
    }
    if (routes.length < 2) {
      warnings.push("Only one route was returned; the comparison is limited.");
    }
  }

  const hull = buildSharedHull(routes.map((route) => route.geometry.coordinates));
  if (hull.exceedsCap) {
    warnings.push(
      "The compared routes span an area larger than the plan cap; using an unpadded hull."
    );
  }

  // Analysis window scoped to the trip's hour range (D1). A zero-width window
  // degrades to filter_type=1 (single hour).
  const windowIsInstant = startTime === endTime;
  const analysisWindow: HeatmapDateRequest = windowIsInstant
    ? { startDate: date, filterType: 1, startTime }
    : { startDate: date, filterType: 2, startTime, endTime };

  const [tcm, exceedance, persistence] = await Promise.all([
    createHeatmap(fortyGuardClient, {
      polygonAoi: hull.aoi,
      startDate: date,
      filterType: 3,
      granularity,
      wait: true
    }),
    createHeatmap(fortyGuardClient, {
      polygonAoi: hull.aoi,
      ...analysisWindow,
      granularity,
      analyticType: "exceedance",
      threshold,
      direction,
      wait: true
    }),
    createHeatmap(fortyGuardClient, {
      polygonAoi: hull.aoi,
      ...analysisWindow,
      granularity,
      analyticType: "persistence",
      threshold,
      direction,
      wait: true
    })
  ]);

  const tcmLookup = buildTileLookup(tcm.map.features, (tile) => tile.maxTemperature ?? tile.temperature);
  const exceedanceLookup = buildTileLookup(exceedance.map.features, (tile) => tile.value);
  const persistenceLookup = buildTileLookup(persistence.map.features, (tile) => tile.value);

  const sampled: Array<{ route: NormalizedRoute; heat: RouteHeatAnalysis | null }> = routes.map((route) => {
    const points = interpolateLine(route.geometry.coordinates, granularity);
    const peak = maxOfSamples(sampleTiles(tcmLookup, points));
    const exceedanceAgg = meanOfSamples(sampleTiles(exceedanceLookup, points));
    const persistenceAgg = meanOfSamples(sampleTiles(persistenceLookup, points));

    if (
      peak.validSamples === 0 ||
      exceedanceAgg.validSamples === 0 ||
      persistenceAgg.validSamples === 0 ||
      peak.value === null ||
      exceedanceAgg.value === null ||
      persistenceAgg.value === null
    ) {
      return { route, heat: null };
    }

    return {
      route,
      heat: {
        peakTemperatureC: peak.value,
        exceedanceHours: exceedanceAgg.value,
        persistenceHours: persistenceAgg.value,
        validSamples: peak.validSamples,
        totalSamples: peak.totalSamples
      }
    };
  });

  const scorable = sampled.filter(
    (entry): entry is { route: NormalizedRoute; heat: RouteHeatAnalysis } => entry.heat !== null
  );
  if (scorable.length === 0) {
    throw new FortyGuardError("No route could be matched to available heat data.");
  }

  const normalizedPeaks = normalizeRelative(scorable.map((entry) => entry.heat.peakTemperatureC));
  const normalizedExceedance = normalizeRelative(scorable.map((entry) => entry.heat.exceedanceHours));
  const normalizedPersistence = normalizeRelative(scorable.map((entry) => entry.heat.persistenceHours));

  const scoredRoutes: AnalyzedRoute[] = sampled.map((entry) => {
    const base = {
      routeId: entry.route.routeId,
      geometry: entry.route.geometry,
      summary: entry.route.summary
    };
    if (entry.heat === null) {
      return { ...base, heat: null, risk: null };
    }
    const index = scorable.findIndex((candidate) => candidate.route.routeId === entry.route.routeId);
    if (index < 0) {
      return { ...base, heat: entry.heat, risk: null };
    }
    const terms = {
      normalizedPeakTemperature: normalizedPeaks[index] as number,
      normalizedExceedance: normalizedExceedance[index] as number,
      normalizedPersistence: normalizedPersistence[index] as number
    };
    const score = segmentRiskScore(terms);
    return { ...base, heat: entry.heat, risk: { score, level: classifyRiskScore(score), terms } };
  });

  const risked = scoredRoutes.filter(
    (route): route is AnalyzedRoute & { heat: RouteHeatAnalysis; risk: RiskAssessment } =>
      route.risk !== null && route.heat !== null
  );

  const ranked = [...risked].sort((a, b) => {
    const scoreDiff = a.risk.score - b.risk.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.summary.durationSeconds - b.summary.durationSeconds;
  });
  const recommended = ranked[0] ?? null;

  let tradeoff: RouteTradeoff | null = null;
  if (recommended && risked.length > 0) {
    const fastestScorable = risked.reduce(
      (fastest, route) =>
        route.summary.durationSeconds < fastest.summary.durationSeconds ? route : fastest,
      risked[0] as AnalyzedRoute & { heat: RouteHeatAnalysis; risk: RiskAssessment }
    );
    if (recommended.routeId !== fastestScorable.routeId) {
      const fastestScore = fastestScorable.risk.score;
      const recommendedScore = recommended.risk.score;
      const reduction =
        fastestScore > 0 && recommendedScore < fastestScore
          ? Math.round(((fastestScore - recommendedScore) / fastestScore) * 100)
          : null;
      tradeoff = {
        recommendedVsFastest: {
          extraMinutes: Math.max(
            0,
            Math.round((recommended.summary.durationSeconds - fastestScorable.summary.durationSeconds) / 60)
          ),
          extraDistanceMeters: Math.max(
            0,
            Math.round(recommended.summary.distanceMeters - fastestScorable.summary.distanceMeters)
          ),
          heatExposureReductionPercent: reduction
        }
      };
    }
  }

  return {
    routes: scoredRoutes,
    hull,
    analyses: ["tcm", "exceedance", "persistence"],
    threshold,
    direction,
    timeWindow: { startTime, endTime },
    recommendation: recommended
      ? { routeId: recommended.routeId, basis: "lowest estimated heat risk" }
      : null,
    tradeoff,
    warnings
  };
}