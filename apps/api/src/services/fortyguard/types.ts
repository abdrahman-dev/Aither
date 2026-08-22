import type {
  HeatmapAnalyticType,
  HeatmapGranularity,
  HeatmapRequest
} from "@aither/shared";

// API-contract types are owned by @aither/shared (the single source both the
// backend and the frontend consume); they are re-exported here so existing
// service-level imports keep working without reaching across package paths.
export type {
  ExceedanceDirection,
  HeatmapAnalyticType,
  HeatmapFilterType,
  HeatmapGranularity,
  PolygonAoi,
  HeatmapRequest,
  HeatmapResult,
  HeatmapStatistics,
  HeatmapTile
} from "@aither/shared";

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

export type HeatmapDateRequest = Pick<
  HeatmapRequest,
  "startDate" | "filterType" | "startTime" | "endTime" | "endDate"
>;

export type CreateHeatmapOptions = HeatmapRequest & {
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

// ---- Normalized env_params output (internal shape, not the promoted contract) ----

export type NormalizedEnvParamSolarIrradiance = {
  clearSky: { ghi: number; dni: number; dhi: number };
  description?: string;
};

export type NormalizedEnvParamLocation = {
  lat: number;
  lon: number;
  elevation: number | null;
  temperature: number | null;
  parameters: Record<string, Array<number | null>>;
  solarIrradiance: NormalizedEnvParamSolarIrradiance | null;
};

export type NormalizedEnvParams = {
  activityId: string;
  metadata: {
    timezone: string;
    timezoneOffsetHours: number | null;
    timeRange: { start: string; end: string; interval?: string; count?: number };
    timestamps: string[];
  };
  locations: NormalizedEnvParamLocation[];
};
