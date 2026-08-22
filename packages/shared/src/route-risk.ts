import type { ApiEnvelope } from "./envelope";
import type { Coordinates } from "./coordinates";
import type { LineStringGeometry, PolygonAoi } from "./geojson";
import type { RouteSummary } from "./route";
import type {
  ExceedanceDirection,
  HeatmapGranularity
} from "./heatmap";

export type HeatRiskLevel = "low" | "moderate" | "high" | "critical";

/** Heat sampling along one route over the shared-hull heatmaps. */
export type RouteHeatAnalysis = {
  peakTemperatureC: number;
  exceedanceHours: number;
  persistenceHours: number;
  validSamples: number;
  totalSamples: number;
};

/** D1 normalized terms (0–1 relative to the compared routes). */
export type RiskTerms = {
  normalizedPeakTemperature: number;
  normalizedExceedance: number;
  normalizedPersistence: number;
};

export type RiskAssessment = {
  score: number;
  level: HeatRiskLevel;
  terms: RiskTerms;
};

/**
 * One compared route. heat/risk are null when the route could not be matched
 * to enough valid heatmap samples (unavailable, never zero-filled).
 */
export type AnalyzedRoute = {
  routeId: string;
  geometry: LineStringGeometry;
  summary: RouteSummary;
  heat: RouteHeatAnalysis | null;
  risk: RiskAssessment | null;
};

/** D2 single shared AOI all compared routes were analyzed against. */
export type SharedHull = {
  aoi: PolygonAoi;
  areaMetersSquared: number;
  padded: boolean;
  clampedToCap: boolean;
  exceedsCap: boolean;
};

export type RouteRecommendation = {
  routeId: string;
  basis: string;
};

/** Cost of taking the recommended route instead of the fastest scorable one. */
export type RouteTradeoff = {
  recommendedVsFastest: {
    extraMinutes: number;
    extraDistanceMeters: number;
    /** null when the recommended route is not actually cooler. */
    heatExposureReductionPercent: number | null;
  };
};

export type AnalysisTimeWindow = {
  startTime: string | null;
  endTime: string | null;
};

/** data payload of POST /api/route-risk. */
export type RouteRiskData = {
  routes: AnalyzedRoute[];
  hull: SharedHull;
  analyses: ["tcm", "exceedance", "persistence"];
  threshold: number;
  direction: ExceedanceDirection;
  timeWindow: AnalysisTimeWindow;
  recommendation: RouteRecommendation | null;
  tradeoff: RouteTradeoff | null;
  warnings: string[];
};

export type RouteRiskApiResponse = ApiEnvelope<RouteRiskData>;

/** POST /api/route-risk request body. date is YYYY-MM-DD, 2021-01-01..today. */
export type RouteRiskRequest = {
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
