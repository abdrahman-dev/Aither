// Route geometry stays GeoJSON [longitude, latitude] at the boundary.
export type RoutePosition = [number, number];
export type LineStringGeometry = { type: "LineString"; coordinates: RoutePosition[] };
export type RouteSummary = { distanceMeters: number; durationSeconds: number };

export type NormalizedRoute = {
  routeId: string;
  geometry: LineStringGeometry;
  summary: RouteSummary;
};

export type RoutingPreference = "fastest" | "shortest" | "recommended";

export type DirectionsOptions = {
  profile?: string;
  preference?: RoutingPreference;
  // ORS alternative_routes; set to false to disable. Requesting alternatives
  // is limited to routes under ~100 km on the hosted API.
  alternativeRoutes?: {
    targetCount?: number;
    shareFactor?: number;
    weightFactor?: number;
  } | false;
};

export type DirectionsResult = {
  routes: NormalizedRoute[];
  warnings: string[];
};

// Raw ORS response shape for POST /v2/directions/{profile}/geojson.
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