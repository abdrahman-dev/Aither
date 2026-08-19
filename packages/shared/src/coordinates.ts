// Coordinate rules (AGENTS.md §53): always explicit { latitude, longitude }
// objects — never raw [number, number] tuples. GeoJSON boundaries may convert.
export type Coordinates = {
  latitude: number;
  longitude: number;
};