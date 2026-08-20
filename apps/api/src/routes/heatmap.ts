import { Router } from "express";
import { createHeatmap, fortyGuardClient } from "../services/fortyguard";
import type {
  CreateHeatmapOptions,
  ExceedanceDirection,
  HeatmapAnalyticType,
  HeatmapFilterType,
  HeatmapGranularity
} from "../services/fortyguard";
import { HEATMAP_ANALYTIC_TYPES, HEATMAP_GRANULARITIES } from "../services/fortyguard";
import { handleServiceError, HttpError, sendOk } from "../utils/http";
import { createInFlightRegistry } from "../utils/inflight";
import { heatmapCache, heatmapCacheKey } from "../utils/requestCache";
import { isFiniteNumber, isPolygonAoi, isSupportedDate, isValidTimeString } from "../utils/validate";

const router = Router();

// Dedupe concurrent identical heatmap requests so duplicates of one logical
// request submit a single FortyGuard activity, not one each.
const heatmapInflight = createInFlightRegistry();

function parseHeatmapRequest(input: unknown): CreateHeatmapOptions {
  if (typeof input !== "object" || input === null) {
    throw new HttpError(400, "Invalid request body.");
  }
  const body = input as Record<string, unknown>;

  if (!isPolygonAoi(body.polygonAoi)) {
    throw new HttpError(
      400,
      "polygonAoi must be a GeoJSON FeatureCollection whose features are Polygon(s) ([longitude, latitude])."
    );
  }

  if (!isSupportedDate(body.startDate)) {
    throw new HttpError(
      400,
      "startDate must be YYYY-MM-DD between 2021-01-01 and today (forecast dates are not supported)."
    );
  }

  const filterType = body.filterType;
  if (filterType !== 1 && filterType !== 2 && filterType !== 3 && filterType !== 4) {
    throw new HttpError(400, "filterType must be 1 (hour), 2 (hour range), 3 (day) or 4 (day range).");
  }

  let startTime: string | undefined;
  let endTime: string | undefined;
  let endDate: string | undefined;
  if (filterType === 1 || filterType === 2) {
    if (!isValidTimeString(body.startTime)) {
      throw new HttpError(400, `filterType ${filterType} requires startTime (HH:MM).`);
    }
    startTime = body.startTime;
    if (filterType === 2) {
      if (!isValidTimeString(body.endTime)) {
        throw new HttpError(400, "filterType 2 requires endTime (HH:MM).");
      }
      endTime = body.endTime;
      if (endTime <= (startTime as string)) {
        throw new HttpError(400, "filterType 2 requires endTime after startTime (same day).");
      }
    }
  }
  if (filterType === 4) {
    if (!isSupportedDate(body.endDate)) {
      throw new HttpError(400, "filterType 4 requires endDate (YYYY-MM-DD, 2021-01-01..today).");
    }
    endDate = body.endDate;
    if (endDate < (body.startDate as string)) {
      throw new HttpError(400, "filterType 4 requires endDate on or after startDate.");
    }
  }

  let granularity: HeatmapGranularity = 100;
  if (body.granularity !== undefined) {
    if (!HEATMAP_GRANULARITIES.includes(body.granularity as HeatmapGranularity)) {
      throw new HttpError(400, "granularity must be 60, 80 or 100 meters.");
    }
    granularity = body.granularity as HeatmapGranularity;
  }

  const analyticType = (body.analyticType ?? "tcm") as HeatmapAnalyticType;
  if (!HEATMAP_ANALYTIC_TYPES.includes(analyticType)) {
    throw new HttpError(
      400,
      `analyticType must be one of ${HEATMAP_ANALYTIC_TYPES.join(", ")}.`
    );
  }

  let threshold: number | undefined;
  let direction: ExceedanceDirection | undefined;
  if (body.threshold !== undefined) {
    if (!isFiniteNumber(body.threshold)) {
      throw new HttpError(400, "threshold must be a number (°C).");
    }
    threshold = body.threshold;
  }
  if (body.direction !== undefined) {
    if (body.direction !== "above" && body.direction !== "below") {
      throw new HttpError(400, "direction must be 'above' or 'below'.");
    }
    direction = body.direction;
  }
  if (
    (analyticType === "exceedance" || analyticType === "persistence") &&
    (threshold === undefined || direction === undefined)
  ) {
    throw new HttpError(
      400,
      `${analyticType} requires threshold (°C) and direction ('above'/'below').`
    );
  }

  return {
    polygonAoi: body.polygonAoi,
    startDate: body.startDate as string,
    filterType: filterType as HeatmapFilterType,
    startTime,
    endTime,
    endDate,
    granularity,
    analyticType,
    threshold,
    direction
  };
}

router.post("/", async (req, res) => {
  try {
    const options = parseHeatmapRequest(req.body);
    const key = heatmapCacheKey({
      aoi: options.polygonAoi,
      startDate: options.startDate,
      filterType: options.filterType,
      startTime: options.startTime,
      endTime: options.endTime,
      endDate: options.endDate,
      granularity: options.granularity,
      analyticType: options.analyticType,
      threshold: options.threshold,
      direction: options.direction
    });
    const cached = heatmapCache.get(key);
    if (cached !== undefined) {
      sendOk(res, "Heatmap generated.", { heatmap: cached });
      return;
    }
    const heatmap = await heatmapInflight.run(key, () => createHeatmap(fortyGuardClient, options));
    heatmapCache.set(key, heatmap);
    sendOk(res, "Heatmap generated.", { heatmap });
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default router;