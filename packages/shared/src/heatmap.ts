import type { ApiEnvelope } from "./envelope";
import type { PolygonAoi, PolygonGeometry } from "./geojson";

export type HeatmapAnalyticType = "tcm" | "time_of_measure" | "exceedance" | "persistence";
export type HeatmapFilterType = 1 | 2 | 3 | 4;
export type HeatmapGranularity = 60 | 80 | 100;
export type ExceedanceDirection = "above" | "below";

/**
 * Statistics are discriminated on the literal `kind` marker the backend emits:
 * "tcm" carries temperature stats, "analysis" carries the analysis-type stats
 * (units/n_cells/min/max/mean). Numeric fields are absent (not zero) when the
 * provider did not supply them.
 */
export type TcmStatistics = {
  kind: "tcm";
  minimum?: number;
  maximum?: number;
  mean?: number;
  standardDeviation?: number;
};

export type AnalysisStatistics = {
  kind: "analysis";
  analyticType: HeatmapAnalyticType;
  units?: string;
  nCells?: number;
  minimum?: number;
  maximum?: number;
  mean?: number;
};

export type HeatmapStatistics = TcmStatistics | AnalysisStatistics;

/**
 * A heatmap tile. Tiles are returned flattened — properties are promoted to
 * the feature level rather than nested under a GeoJSON `properties` object.
 * Which numeric fields appear depends on analyticType/filterType: tcm carries
 * `temperature` (filterType 1/2) or average/min/max temperature (3/4); the
 * analysis types carry a single `value`. Absent means unavailable, never 0.
 */
export type HeatmapTile = {
  id: string;
  geometry: PolygonGeometry;
  tileId: number;
  temperature?: number;
  averageTemperature?: number;
  minTemperature?: number;
  maxTemperature?: number;
  value?: number;
};

/** FeatureCollection wrapper around the flattened tiles. */
export type HeatmapTileCollection = {
  type: "FeatureCollection";
  features: HeatmapTile[];
};

/** One generated heatmap: tiles plus the statistics summary over them. */
export type HeatmapResult = {
  activityId: string;
  analyticType: HeatmapAnalyticType;
  filterType: HeatmapFilterType;
  /** "hour" for the analysis types; null for tcm. */
  units: string | null;
  map: HeatmapTileCollection;
  statistics: HeatmapStatistics;
};

/** data payload of POST /api/heatmap. */
export type HeatmapData = {
  heatmap: HeatmapResult;
};

export type HeatmapApiResponse = ApiEnvelope<HeatmapData>;

/**
 * POST /api/heatmap request body. filterType: 1 = single hour (startTime),
 * 2 = hour range (startTime + endTime), 3 = single full day, 4 = day range
 * (endDate). exceedance/persistence additionally require threshold+direction.
 */
export type HeatmapRequest = {
  polygonAoi: PolygonAoi;
  startDate: string;
  filterType: HeatmapFilterType;
  startTime?: string;
  endTime?: string;
  endDate?: string;
  granularity?: HeatmapGranularity;
  analyticType?: HeatmapAnalyticType;
  threshold?: number;
  direction?: ExceedanceDirection;
};
