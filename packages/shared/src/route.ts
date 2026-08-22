import type { ApiEnvelope } from "./envelope";
import type { Coordinates } from "./coordinates";
import type { LineStringGeometry } from "./geojson";

export type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
};

/** One route option as returned by POST /api/route and nested in route-risk. */
export type PlannedRoute = {
  routeId: string;
  geometry: LineStringGeometry;
  summary: RouteSummary;
};

/** data payload of POST /api/route. */
export type RoutesData = {
  routes: PlannedRoute[];
  warnings: string[];
};

export type RoutesApiResponse = ApiEnvelope<RoutesData>;

/** POST /api/route request body. profile is an ORS profile (default foot-walking). */
export type RouteRequest = {
  origin: Coordinates;
  destination: Coordinates;
  profile?: string;
};
