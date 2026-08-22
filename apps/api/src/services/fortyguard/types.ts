export type HeatmapAnalyticType = "tcm" | "time_of_measure" | "exceedance" | "persistence";
export type HeatmapFilterType = 1 | 2 | 3 | 4;
export type HeatmapGranularity = 60 | 80 | 100;
export type ExceedanceDirection = "above" | "below";

export const HEATMAP_ANALYTIC_TYPES: readonly HeatmapAnalyticType[] = [
  "tcm",
  "time_of_measure",
  "exceedance",
  "persistence"
];

export const HEATMAP_GRANULARITIES: readonly HeatmapGranularity[] = [60, 80, 100];

// The exact 17 analysis names the env_params endpoint accepts (the reference
// client validates against this set before sending; no count cap exists).
export const ENV_PARAMS_ANALYSES: readonly string[] = [
  "heat_index_celsius",
  "apparent_temperature_celsius",
  "wet_bulb_temperature_celsius",
  "relative_humidity_percent",
  "precipitation_mm",
  "cloud_cover_octas",
  "air_quality:idx",
  "air_quality_no2:idx",
  "air_quality_o3:idx",
  "air_quality_pm2p5:idx",
  "air_quality_pm10:idx",
  "air_quality_so2:idx",
  "aqi_us_co",
  "methane_ppb",
  "co2_ppm",
  "elevation",
  "solar_irradiance"
];

export type PolygonAoi = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
};

export type HeatmapDateRequest = {
  startDate: string;
  filterType: HeatmapFilterType;
  startTime?: string;
  endTime?: string;
  endDate?: string;
};

export type CreateHeatmapOptions = HeatmapDateRequest & {
  polygonAoi: PolygonAoi;
  granularity?: HeatmapGranularity;
  analyticType?: HeatmapAnalyticType;
  threshold?: number;
  direction?: ExceedanceDirection;
  // When false, only the activity_id is returned (submission without polling).
  wait?: boolean;
  pollIntervalSeconds?: number;
  timeoutSeconds?: number;
};

export type EnvParamsOptions = HeatmapDateRequest & {
  latitude: number;
  longitude: number;
  temperature: number;
  analysis?: readonly string[];
  wait?: boolean;
  pollIntervalSeconds?: number;
  timeoutSeconds?: number;
};

// ---- Raw FortyGuard boundary shapes (see Aither_FortyGuard_API_Reference.md §3) ----

export type FortyGuardEnvelope<T> = {
  error: boolean;
  message?: string;
  data: T;
};

export type ActivityStatusData<T> = {
  activity_id: string;
  status?: string;
  result?: T;
  message?: string;
};

export type HeatmapTileFeature = {
  id?: string;
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: number[][][] };
};

export type HeatmapResultRaw = {
  map_data?: { type?: string; features?: HeatmapTileFeature[] } | null;
  stats_data?: Record<string, unknown> | null;
};

export type EnvParamsLocationRaw = {
  lat: number | string;
  lon: number | string;
  elevation: number | string | null;
  temperature: number | string | null;
  parameters: Record<string, unknown>;
  solar_irradiance: {
    clear_sky: { ghi: number | string; dni: number | string; dhi: number | string };
    description?: string;
  } | null;
};

export type EnvParamsResultRaw = {
  metadata: {
    timezone: string;
    timezone_offset_hours?: number | string;
    time_range: {
      start: string;
      end: string;
      interval?: string;
      count?: number | string;
    };
    timestamps: string[];
  };
  locations: EnvParamsLocationRaw[];
};

// ---- Normalized domain shapes ----

export type NormalizedHeatmapTile = {
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  tileId: number;
  temperature?: number;
  averageTemperature?: number;
  minTemperature?: number;
  maxTemperature?: number;
  value?: number;
};

export type HeatmapStatistics =
  | {
      kind: "tcm";
      minimum?: number;
      maximum?: number;
      mean?: number;
      standardDeviation?: number;
    }
  | {
      kind: "analysis";
      analyticType: HeatmapAnalyticType;
      units?: string;
      nCells?: number;
      minimum?: number;
      maximum?: number;
      mean?: number;
    };

export type NormalizedHeatmap = {
  activityId: string;
  analyticType: HeatmapAnalyticType;
  filterType: HeatmapFilterType;
  // "hour" for the analysis types; null for tcm.
  units: string | null;
  map: { type: "FeatureCollection"; features: NormalizedHeatmapTile[] };
  statistics: HeatmapStatistics;
};

export type EnvParamLocation = {
  lat: number;
  lon: number;
  elevation: number | null;
  temperature: number | null;
  // Per-sample nulls are preserved as unavailable (AGENTS.md §13).
  parameters: Record<string, Array<number | null>>;
  solarIrradiance: {
    clearSky: { ghi: number; dni: number; dhi: number };
    description?: string;
  } | null;
};

export type NormalizedEnvParams = {
  activityId: string;
  metadata: {
    timezone: string;
    timezoneOffsetHours: number | null;
    timeRange: { start: string; end: string; interval?: string; count?: number };
    timestamps: string[];
  };
  locations: EnvParamLocation[];
};