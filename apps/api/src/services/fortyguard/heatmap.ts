import { FortyGuardClient } from "./client";
import { FortyGuardError, NO_DATA_FOR_DATE_MESSAGE, NoCoverageError } from "./errors";
import {
  HEATMAP_ANALYTIC_TYPES,
  type CreateHeatmapOptions,
  type HeatmapResultRaw,
  type HeatmapTileFeature
} from "./types";
import type {
  HeatmapAnalyticType,
  HeatmapResult,
  HeatmapStatistics,
  HeatmapTile
} from "@aither/shared";
import { todayAsDateString } from "../../utils/validate";

function readNumber(properties: Record<string, unknown>, key: string): number | undefined {
  const value = properties[key];
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  // FortyGuard serializes some numbers as strings elsewhere in the contract
  // (env_params elevation/temperature are number|string|null), so accept
  // numeric strings defensively at this boundary too.
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function tileIdOf(feature: HeatmapTileFeature, index: number): number {
  const value = feature.properties.tile_id;
  return typeof value === "number" && Number.isFinite(value) ? value : index;
}

// Null values in response data stay "unavailable" (undefined), never 0
// (AGENTS.md §13).
function normalizeTile(
  feature: HeatmapTileFeature,
  index: number,
  analyticType: HeatmapAnalyticType
): HeatmapTile {
  const properties = feature.properties;
  const tile: HeatmapTile = {
    id: feature.id ?? String(index),
    // Raw vendor coordinates are number[][][]; the shared contract narrows
    // them to [longitude, latitude] pairs at this boundary (AGENTS.md §52).
    geometry: feature.geometry as HeatmapTile["geometry"],
    tileId: tileIdOf(feature, index)
  };

  if (analyticType === "tcm") {
    tile.averageTemperature = readNumber(properties, "average_temperature");
    tile.minTemperature = readNumber(properties, "min_temperature");
    tile.maxTemperature = readNumber(properties, "max_temperature");
    tile.temperature = readNumber(properties, "temperature");
  } else {
    tile.value = readNumber(properties, "value");
  }
  return tile;
}

function normalizeStatistics(
  raw: HeatmapResultRaw["stats_data"],
  analyticType: HeatmapAnalyticType
): HeatmapStatistics {
  const stats = (raw ?? {}) as Record<string, unknown>;

  if (analyticType === "tcm") {
    const temperatureStats = (stats.temperature_stats ?? {}) as Record<string, unknown>;
    return {
      kind: "tcm",
      minimum: readNumber(temperatureStats, "minimum"),
      maximum: readNumber(temperatureStats, "maximum"),
      mean: readNumber(temperatureStats, "mean"),
      standardDeviation: readNumber(temperatureStats, "standard_deviation")
    };
  }

  return {
    kind: "analysis",
    analyticType:
      typeof stats.analytic_type === "string"
        ? (stats.analytic_type as HeatmapAnalyticType)
        : analyticType,
    units: typeof stats.units === "string" ? stats.units : undefined,
    nCells: readNumber(stats, "n_cells"),
    minimum: readNumber(stats, "min"),
    maximum: readNumber(stats, "max"),
    mean: readNumber(stats, "mean")
  };
}

export function normalizeHeatmap(input: {
  activityId: string;
  analyticType: HeatmapAnalyticType;
  filterType: CreateHeatmapOptions["filterType"];
  result: HeatmapResultRaw;
}): HeatmapResult {
  const { activityId, analyticType, filterType, result } = input;
  const stats = result.stats_data;

  const units =
    analyticType === "tcm"
      ? null
      : typeof (stats?.units as unknown) === "string"
        ? (stats?.units as string)
        : null;

  const features = (result.map_data?.features ?? []).map((feature, index) =>
    normalizeTile(feature, index, analyticType)
  );

  return {
    activityId,
    analyticType,
    filterType,
    units,
    map: { type: "FeatureCollection", features },
    statistics: normalizeStatistics(stats, analyticType)
  };
}

/**
 * POST /v1/heatmap then poll until completion. Response normalization branches
 * on analytic_type (AGENTS.md §9.3): tcm tiles carry temperature fields, the
 * analysis types carry properties.value interpreted via stats_data.units.
 * Pass wait=false to receive only the activity_id.
 */
export async function createHeatmap(
  client: FortyGuardClient,
  options: CreateHeatmapOptions & { wait: true }
): Promise<HeatmapResult>;
export async function createHeatmap(
  client: FortyGuardClient,
  options: CreateHeatmapOptions & { wait: false }
): Promise<string>;
export async function createHeatmap(
  client: FortyGuardClient,
  options: CreateHeatmapOptions
): Promise<HeatmapResult | string>;
export async function createHeatmap(
  client: FortyGuardClient,
  options: CreateHeatmapOptions
): Promise<HeatmapResult | string> {
  const analyticType = options.analyticType ?? "tcm";
  const threshold = options.threshold;
  const direction = options.direction;

  if (!HEATMAP_ANALYTIC_TYPES.includes(analyticType)) {
    throw new FortyGuardError(
      `Unknown analytic_type ${JSON.stringify(analyticType)}. Valid options: ${HEATMAP_ANALYTIC_TYPES.join(", ")}`
    );
  }
  if (analyticType === "exceedance" || analyticType === "persistence") {
    if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
      throw new FortyGuardError(
        `analytic_type=${analyticType} requires a threshold (°C).`
      );
    }
    if (direction !== "above" && direction !== "below") {
      throw new FortyGuardError(
        `analytic_type=${analyticType} requires direction 'above' or 'below'.`
      );
    }
  }

  const dateTime: Record<string, unknown> = {
    start_date: options.startDate,
    filter_type: options.filterType
  };
  if (options.startTime !== undefined) dateTime.start_time = options.startTime;
  if (options.endTime !== undefined) dateTime.end_time = options.endTime;
  if (options.endDate !== undefined) dateTime.end_date = options.endDate;

  const payload: Record<string, unknown> = {
    polygon_aoi: options.polygonAoi,
    date_time: dateTime,
    granularity: options.granularity ?? 100,
    analytic_type: analyticType
  };
  if (threshold !== undefined) payload.threshold = threshold;
  if (direction !== undefined) payload.direction = direction;

  const activityId = await client.submit("/v1/heatmap", payload);
  console.log(
    `Heatmap activity submitted activityId=${activityId} analyticType=${analyticType}`
  );

  if (options.wait === false) {
    return activityId;
  }

  const result = await client.waitForActivity<HeatmapResultRaw>(activityId, {
    pollIntervalSeconds: options.pollIntervalSeconds,
    timeoutSeconds: options.timeoutSeconds
  });

  // Detect FortyGuard's "no data for this area" response FIRST: out-of-coverage
  // activities complete normally with no tile features and a stats object that
  // may still be present carrying only marker keys (observed in production:
  // tcm responses where stats_data is non-empty but temperature_stats holds no
  // numeric values). So emptiness of stats_data itself is NOT the test — the
  // absence of any usable numeric statistic is. Reusing normalizeStatistics
  // keeps the guard's notion of "numeric data" in lockstep with what we would
  // otherwise hand back to clients.
  const features = Array.isArray(result?.map_data?.features)
    ? result.map_data.features
    : [];
  const hasFeatures = features.length > 0;
  const stats = normalizeStatistics(result?.stats_data, analyticType);
  const hasNumericStats =
    stats.kind === "tcm"
      ? stats.minimum !== undefined ||
        stats.maximum !== undefined ||
        stats.mean !== undefined ||
        stats.standardDeviation !== undefined
      : stats.nCells !== undefined ||
        stats.minimum !== undefined ||
        stats.maximum !== undefined ||
        stats.mean !== undefined;
  if (!hasFeatures && !hasNumericStats) {
    // The response body cannot distinguish "area out of coverage" from
    // "covered area, nothing published for this date yet" — both complete with
    // zero tiles and marker-only stats. A request dated today is almost always
    // the latter (observed live: same-day TCM completes empty across Arizona
    // while past dates return full data), so pick the message by request date
    // and log the raw evidence so future occurrences diagnose themselves.
    console.warn(
      `[fortyguard] no-data result analyticType=${analyticType} startDate=${options.startDate} ` +
        `featureCount=${features.length} rawStats=${JSON.stringify(result?.stats_data ?? null)}`
    );
    throw new NoCoverageError(
      options.startDate === todayAsDateString() ? NO_DATA_FOR_DATE_MESSAGE : undefined
    );
  }

  if (!result?.map_data || !Array.isArray(result.map_data.features)) {
    throw new FortyGuardError("Heatmap activity completed without map_data.");
  }

  return normalizeHeatmap({
    activityId,
    analyticType,
    filterType: options.filterType,
    result
  });
}