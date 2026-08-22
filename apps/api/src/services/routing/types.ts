import type { LineStringGeometry, PlannedRoute, RoutesData } from "@aither/shared";

// Contract-level route shapes are owned by @aither/shared; these aliases keep
// the internal client vocabulary without duplicating types (AGENTS.md §21).
export type { LineStringGeometry, PlannedRoute, RouteSummary } from "@aither/shared";
export type NormalizedRoute = PlannedRoute;
export type DirectionsResult = RoutesData;

export type RoutingPreference = "fastest" | "shortest" | "recommended";

export type DirectionsOptions = {
  profile?: string;
  preference?: RoutingPreference;
  // ORS alternative_routes options; leave undefined for defaults.
  alternativeRoutes?:
    | {
        targetCount?: number;
        weightFactor?: number;
        shareFactor?: number;
      }
    | false;
};

// Raw OpenRouteService boundary shape. Only the fields we consume are typed.
export type OrsDirectionsResponse = {
  type?: string;
  features?: Array<{
    geometry?: LineStringGeometry;
    properties?: {
      summary?: { distance?: unknown; duration?: unknown };
      segments?: unknown[];
      way_points?: unknown[];
    };
  }>;
  metadata?: Record<string, unknown>;
};
