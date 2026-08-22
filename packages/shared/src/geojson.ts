// Minimal GeoJSON vocabulary for the Aither API contract. Positions follow
// GeoJSON order: [longitude, latitude] (AGENTS.md §53) — the tuple is the
// documented exception to the { latitude, longitude } object rule.
export type GeoJsonPosition = [number, number];

export type LineStringGeometry = {
  type: "LineString";
  coordinates: GeoJsonPosition[];
};

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: GeoJsonPosition[][];
};

export type PolygonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: PolygonGeometry;
};

/**
 * Area-of-interest request body shape: a GeoJSON FeatureCollection whose
 * features are closed Polygons ([longitude, latitude] rings).
 */
export type PolygonAoi = {
  type: "FeatureCollection";
  features: PolygonFeature[];
};
