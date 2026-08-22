import { Router } from "express";
import type { Coordinates, RouteRequest, RouteRiskData, RoutesData } from "@aither/shared";
import { orsClient, DEFAULT_ROUTING_PROFILE } from "../services/routing";
import { analyzeRouteRisk, parseRouteRiskInput } from "../services/heat/routeAnalysis";
import { handleServiceError, HttpError, sendOk } from "../utils/http";
import { createInFlightRegistry } from "../utils/inflight";
import { routeCache, routeCacheKey, routeRiskCache, routeRiskCacheKey } from "../utils/requestCache";
import { isValidCoordinates } from "../utils/validate";

const router = Router();

// Dedupe concurrent identical route-risk requests so one logical comparison
// submits a single tcm/exceedance/persistence activity set, not one per copy.
const routeRiskInflight = createInFlightRegistry();

// Required<RouteRequest>: defaults are applied here, so profile is always set.
function parseRouteRequest(input: unknown): Required<RouteRequest> {
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
  const profile =
    typeof body.profile === "string" && body.profile.trim() !== ""
      ? body.profile
      : DEFAULT_ROUTING_PROFILE;
  return {
    origin: body.origin as Coordinates,
    destination: body.destination as Coordinates,
    profile
  };
}

router.post("/route", async (req, res) => {
  try {
    const { origin, destination, profile } = parseRouteRequest(req.body);
    const key = routeCacheKey({ origin, destination, profile });
    const cached = routeCache.get(key);
    if (cached !== undefined) {
      sendOk<RoutesData>(res, "Routes generated.", cached);
      return;
    }
    const result = await orsClient.directions(
      [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ],
      { profile }
    );
    routeCache.set(key, result);
    sendOk<RoutesData>(res, "Routes generated.", result);
  } catch (error) {
    handleServiceError(res, error);
  }
});

router.post("/route-risk", async (req, res) => {
  try {
    const parsed = parseRouteRiskInput(req.body);
    const key = routeRiskCacheKey({
      origin: parsed.origin,
      destination: parsed.destination,
      date: parsed.date,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      threshold: parsed.threshold,
      direction: parsed.direction,
      profile: parsed.profile,
      granularity: parsed.granularity
    });
    const cached = routeRiskCache.get(key);
    if (cached !== undefined) {
      sendOk<RouteRiskData>(res, "Route heat comparison complete.", cached);
      return;
    }
    const result = await routeRiskInflight.run(key, () => analyzeRouteRisk(req.body));
    routeRiskCache.set(key, result);
    sendOk<RouteRiskData>(res, "Route heat comparison complete.", result);
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default router;