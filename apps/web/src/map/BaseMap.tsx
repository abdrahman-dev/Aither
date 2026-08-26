import { useEffect, useRef } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl
} from "maplibre-gl";
// MapLibre v6 does tile/GeoJSON processing in a real module worker. Bundlers
// like Vite cannot resolve it from import.meta.url — without this one-time
// registration the style never finishes loading ("load" never fires) and
// sources/layers silently never appear.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(maplibreWorkerUrl);
import type {
  ErrorEvent as MapLibreErrorEvent,
  ExpressionSpecification,
  LayerSpecification,
  MapMouseEvent
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coordinates, HeatRiskLevel, RouteRiskData } from "@aither/shared";
import type { CurrentLocation, PickTarget } from "../features/routing/useTripPlanning";

// Placeholder default view so the base map boots somewhere recognizable.
const DEFAULT_CENTER: Coordinates = { latitude: 33.4484, longitude: -112.07396 };
const DEFAULT_ZOOM = 11;

// Marker colors reuse §4's documented focus colors (origin sky, destination emerald).
const ORIGIN_COLOR = "#38BDF8";
const DESTINATION_COLOR = "#34D399";

// Standard "you are here" blue — deliberately distinct from the origin sky-blue
// pin and absent from the §2 palette because this dot means the user, not trip data.
const CURRENT_LOCATION_COLOR = "#2563EB";

// UIUX_Design_Guidelines.md §2.4 tokens as solid line colors: low → Emerald 600,
// moderate → Orange 500 (the documented toggle token — Orange 700 read as nearly
// the same dark warm tone as Red 600 at line width, hiding risk differences),
// high/critical → Red 600. Routes without heat data use tertiary gray (#94A3B8).
// Shared with the midpoint number badges so a line and its chip always match.
const LEVEL_LINE_COLORS = {
  low: "#059669",
  moderate: "#F97316",
  high: "#DC2626",
  critical: "#DC2626",
  unknown: "#94A3B8"
} as const;

const ROUTE_LINE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match",
  ["get", "level"],
  "low",
  LEVEL_LINE_COLORS.low,
  "moderate",
  LEVEL_LINE_COLORS.moderate,
  "high",
  LEVEL_LINE_COLORS.high,
  "critical",
  LEVEL_LINE_COLORS.critical,
  LEVEL_LINE_COLORS.unknown
];

// Alternative routes share corridors, and MapLibre paints later features on top.
// Hottest routes go in first (bottom); cooler ones — and always the recommended
// route — end up on top so shared segments never hide the better option.
const LEVEL_DRAW_ORDER: Record<HeatRiskLevel | "unknown", number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  unknown: 4
};

const ROUTES_SOURCE_ID = "aither-route-risk";

type RouteLineProperties = {
  routeId: string;
  level: HeatRiskLevel | "unknown";
  recommended: boolean;
};

type BaseMapProps = {
  center?: Coordinates;
  zoom?: number;
  origin?: Coordinates | null;
  destination?: Coordinates | null;
  /** When set, the next map click arms point selection (crosshair cursor). */
  pickingPoint?: PickTarget | null;
  onMapClick?: ((coordinates: Coordinates) => void) | null;
  /** Successful /api/route-risk payload whose routes are drawn on the map. */
  routeResult?: RouteRiskData | null;
  /** One-shot device fix shown as the blue "you are here" dot. */
  currentLocation?: CurrentLocation | null;
};

// CARTO Voyager: a free, keyless vector basemap. The earlier Positron pass
// overshot into "featureless" — users lost street names, water/park contrast,
// and landmark cues needed to orient themselves. Voyager keeps the calm label
// hierarchy while restoring subtle color-coding (green parks, blue water, warm
// road classes), so the map reads as a place again yet stays far cleaner than
// raw OSM. Its muted palette still lets Aither's own signals — brand
// sky/emerald markers and the risk-tier route lines — lead the screen (§27).
const BASEMAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// White casing under every line keeps risk colors readable over the OSM raster;
// the recommended route additionally gets a wider casing plus a soft brand glow.
function buildRouteLayers(): LayerSpecification[] {
  return [
    {
      id: "aither-routes-glow",
      type: "line",
      source: ROUTES_SOURCE_ID,
      filter: ["==", ["get", "recommended"], true],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#38BDF8",
        "line-width": 14,
        "line-opacity": 0.22,
        "line-blur": 5
      }
    },
    {
      id: "aither-routes-casing",
      type: "line",
      source: ROUTES_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#FFFFFF",
        "line-opacity": 0.9,
        "line-width": ["case", ["get", "recommended"], 10, 7]
      }
    },
    {
      id: "aither-routes-line",
      type: "line",
      source: ROUTES_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ROUTE_LINE_COLOR_EXPRESSION,
        "line-width": ["case", ["get", "recommended"], 5.5, 3.5]
      }
    }
  ];
}

function buildRouteLines(
  result: RouteRiskData | null
): FeatureCollection<LineString, RouteLineProperties> {
  const recommendedId = result?.recommendation?.routeId ?? null;
  const ranked: { feature: Feature<LineString, RouteLineProperties>; rank: number }[] = [];
  for (const route of result?.routes ?? []) {
    if (route.geometry.coordinates.length < 2) continue; // degenerate geometry guard
    const recommended = recommendedId !== null && route.routeId === recommendedId;
    const level = route.risk ? route.risk.level : "unknown";
    ranked.push({
      feature: {
        type: "Feature",
        properties: { routeId: route.routeId, level, recommended },
        geometry: route.geometry
      },
      // Hottest first; the recommended route jumps ahead of everything.
      rank: LEVEL_DRAW_ORDER[level] + (recommended ? 10 : 0)
    });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  return { type: "FeatureCollection", features: ranked.map((entry) => entry.feature) };
}

// Endpoint pins carry bold A/B lettering so origin vs. destination reads at a
// glance on the map alone, no tooltip or panel cross-checking required.
function createPinElement(color: string, label: string, letter: string): HTMLDivElement {
  const element = document.createElement("div");
  element.title = label;
  element.style.width = "22px";
  element.style.height = "22px";
  element.style.boxSizing = "border-box";
  element.style.borderRadius = "9999px";
  element.style.backgroundColor = color;
  element.style.border = "3px solid #FFFFFF";
  element.style.boxShadow = "0 4px 20px rgba(30, 41, 59, 0.35)";
  element.style.pointerEvents = "none";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "11px";
  element.style.fontWeight = "800";
  element.style.color = "#FFFFFF";
  element.textContent = letter;
  // Pleasant drop-in instead of an instant pop (Part 2 polish).
  element.className = "aither-marker-drop";
  return element;
}

// §2.3 primary gradient, inline form for canvas-level marker elements.
const BRAND_GRADIENT_CSS = "linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #34D399 100%)";

// Numbered midpoint chips tie each drawn line to its Results Card entry
// ("Route N"), which disambiguates same-risk-tier routes whose line colors
// repeat. The recommended route swaps its risk color for the brand gradient so
// it reads first; shadows reuse §3.2's documented button/marker shadow values.
function createRouteNumberBadge(
  number: number,
  color: string,
  recommended: boolean
): HTMLDivElement {
  const element = document.createElement("div");
  element.title = recommended ? `Route ${number} — Recommended` : `Route ${number}`;
  element.style.width = "20px";
  element.style.height = "20px";
  element.style.boxSizing = "border-box";
  element.style.borderRadius = "9999px";
  element.style.background = recommended ? BRAND_GRADIENT_CSS : color;
  element.style.border = "2px solid #FFFFFF";
  element.style.boxShadow = recommended
    ? "0 6px 20px rgba(56, 189, 248, 0.35)"
    : "0 4px 20px rgba(30, 41, 59, 0.35)";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "10px";
  element.style.fontWeight = "800";
  element.style.color = "#FFFFFF";
  element.textContent = String(number);
  element.style.pointerEvents = "none";
  element.className = "aither-marker-drop";
  return element;
}

// Classic accuracy-halo dot; a heading wedge is added only when the device
// reported one (one-shot fixes usually have heading === null on desktop).
function createCurrentLocationElement(heading: number | null): HTMLDivElement {
  const root = document.createElement("div");
  root.title = "Your location";
  // Must be taken out of flow: MapLibre places marker elements purely via a
  // pixel transform on top of its ".maplibregl-marker { position: absolute }"
  // stylesheet rule. An inline `relative` overrides that rule, leaves the
  // element in flow at the container's top-left corner, and the transform then
  // displaces it from there — the marker lands far from its real coordinates.
  root.style.position = "absolute";
  root.style.width = "22px";
  root.style.height = "22px";
  root.style.pointerEvents = "none";
  root.className = "aither-marker-drop";

  const halo = document.createElement("span");
  halo.setAttribute("aria-hidden", "true");
  halo.className = "absolute inset-0 animate-ping rounded-full";
  halo.style.backgroundColor = CURRENT_LOCATION_COLOR;
  halo.style.opacity = "0.25";
  root.appendChild(halo);

  const dot = document.createElement("span");
  dot.style.position = "absolute";
  dot.style.inset = "3px";
  dot.style.borderRadius = "9999px";
  dot.style.backgroundColor = CURRENT_LOCATION_COLOR;
  dot.style.border = "3px solid #FFFFFF";
  dot.style.boxShadow = "0 4px 20px rgba(30, 41, 59, 0.35)";
  root.appendChild(dot);

  if (heading !== null) {
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.style.position = "absolute";
    arrow.style.left = "50%";
    arrow.style.top = "50%";
    arrow.style.width = "0";
    arrow.style.height = "0";
    arrow.style.borderLeft = "5px solid transparent";
    arrow.style.borderRight = "5px solid transparent";
    arrow.style.borderBottom = `8px solid ${CURRENT_LOCATION_COLOR}`;
    // rotate(a) translateY(-d) puts the triangle d px out at compass angle a
    // (0° = north/up), so it orbits the dot center as heading changes.
    arrow.style.transform = `translate(-50%, -50%) rotate(${heading}deg) translateY(-15px)`;
    root.appendChild(arrow);
  }

  return root;
}

// Surface MapLibre problems loudly — silent map failures are unacceptable for
// a route-comparison product.
function logMapError(event: MapLibreErrorEvent): void {
  console.error("[aither-map] MapLibre error:", event.error ?? "unknown");
}

function applyRoutesToMap(map: MapLibreMap, result: RouteRiskData | null): void {
  const source = map.getSource(ROUTES_SOURCE_ID);
  if (!source || source.type !== "geojson") {
    console.warn("[aither-map] route source missing — style not ready; routes not drawn");
    return;
  }
  if (!map.getLayer("aither-routes-line")) {
    console.warn("[aither-map] route layers missing — routes not drawn");
    return;
  }
  const featureCollection = buildRouteLines(result);
  (source as GeoJSONSource).setData(featureCollection);
  console.info(
    `[aither-map] drew ${featureCollection.features.length} route(s)` +
      (result ? ` for ${result.routes.length} analyzed route(s)` : "")
  );
}

export default function BaseMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  origin = null,
  destination = null,
  pickingPoint = null,
  onMapClick = null,
  routeResult = null,
  currentLocation = null
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const originMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const routeBadgesRef = useRef<Marker[]>([]);
  const currentLocationMarkerRef = useRef<Marker | null>(null);

  // Latest-callback refs so handlers registered once at mount always observe
  // current props without resubscribing.
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const routesReadyRef = useRef(false);
  const pendingResultRef = useRef<RouteRiskData | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new MapLibreMap({
      container: containerRef.current,
      // MapLibre expects [longitude, latitude]; keep the shared Coordinates object explicit.
      center: [center.longitude, center.latitude],
      zoom,
      style: BASEMAP_STYLE_URL,
      // CARTO's free tier requires visible attribution; the Voyager style's
      // TileJSON carries "© CARTO, © OpenStreetMap contributors" and this
      // control renders it expanded rather than collapsed behind an (i) button.
      attributionControl: { compact: false }
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("error", logMapError);

    map.on("click", (event: MapMouseEvent) => {
      onMapClickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    });

    map.on("load", () => {
      if (!map.getSource(ROUTES_SOURCE_ID)) {
        map.addSource(ROUTES_SOURCE_ID, { type: "geojson", data: buildRouteLines(null) });
        for (const layer of buildRouteLayers()) {
          map.addLayer(layer);
        }
      }
      routesReadyRef.current = true;
      console.info("[aither-map] style loaded — route source & layers ready");
      if (pendingResultRef.current !== null) {
        const pending = pendingResultRef.current;
        pendingResultRef.current = null;
        applyRoutesToMap(map, pending);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      originMarkerRef.current = null;
      destinationMarkerRef.current = null;
      routeBadgesRef.current = [];
      currentLocationMarkerRef.current = null;
      routesReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickingPoint !== null ? "crosshair" : "";
  }, [pickingPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!origin) {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      return;
    }
    if (originMarkerRef.current) {
      originMarkerRef.current.setLngLat([origin.longitude, origin.latitude]);
      return;
    }
    if (!map) return;
    originMarkerRef.current = new Marker({
      element: createPinElement(ORIGIN_COLOR, "Origin", "A")
    })
      .setLngLat([origin.longitude, origin.latitude])
      .addTo(map);
  }, [origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!destination) {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      return;
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setLngLat([destination.longitude, destination.latitude]);
      return;
    }
    if (!map) return;
    destinationMarkerRef.current = new Marker({
      element: createPinElement(DESTINATION_COLOR, "Destination", "B")
    })
      .setLngLat([destination.longitude, destination.latitude])
      .addTo(map);
  }, [destination]);

  // Rebuilt per fix: one-shot geolocation means updates are rare, and a rebuild
  // keeps the heading wedge in sync without imperative style bookkeeping.
  useEffect(() => {
    const map = mapRef.current;
    currentLocationMarkerRef.current?.remove();
    currentLocationMarkerRef.current = null;
    if (!map || !currentLocation) return;
    // Once the fix is adopted as the trip origin, the labeled "A" pin marks
    // that exact spot; hiding the raw dot avoids two different blue markers
    // stacked on one point. Re-picking the origin elsewhere reveals it again.
    if (
      origin &&
      origin.latitude === currentLocation.latitude &&
      origin.longitude === currentLocation.longitude
    ) {
      return;
    }
    currentLocationMarkerRef.current = new Marker({
      element: createCurrentLocationElement(currentLocation.heading)
    })
      .setLngLat([currentLocation.longitude, currentLocation.latitude])
      .addTo(map);
  }, [currentLocation, origin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!routesReadyRef.current) {
      // Sources/layers are added on "load"; remember the latest result so the
      // load handler can apply it if it arrives unusually early.
      console.warn(
        "[aither-map] route result arrived before map style loaded — parking until 'load' fires"
      );
      pendingResultRef.current = routeResult;
      return;
    }

    applyRoutesToMap(map, routeResult);

    for (const marker of routeBadgesRef.current) {
      marker.remove();
    }
    routeBadgesRef.current = [];

    if (routeResult === null) {
      return;
    }

    // Fit bounds to everything returned so the user sees the analysis without
    // panning manually.
    const bounds = new LngLatBounds();
    let sawCoordinate = false;
    for (const route of routeResult.routes) {
      for (const position of route.geometry.coordinates) {
        bounds.extend([position[0], position[1]]);
        sawCoordinate = true;
      }
    }
    if (sawCoordinate) {
      map.fitBounds(bounds, { padding: 90, duration: 900, maxZoom: 15 });
    }

    // One numbered chip per route at its midpoint, indexed identically to the
    // Results Card list, so any line maps to its card entry even when risk
    // tiers (and therefore line colors) repeat.
    for (const [index, route] of routeResult.routes.entries()) {
      const coordinates = route.geometry.coordinates;
      const midpoint = coordinates[Math.floor((coordinates.length - 1) / 2)];
      if (!midpoint) continue;
      const recommended = routeResult.recommendation?.routeId === route.routeId;
      const level = route.risk ? route.risk.level : "unknown";
      routeBadgesRef.current.push(
        new Marker({
          element: createRouteNumberBadge(index + 1, LEVEL_LINE_COLORS[level], recommended)
        })
          .setLngLat([midpoint[0], midpoint[1]])
          .addTo(map)
      );
    }
  }, [routeResult]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Armed-picking helper chip; fades in/out without intercepting clicks. */}
      <div
        role="status"
        aria-hidden={pickingPoint === null}
        className={`pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 whitespace-nowrap rounded-pill border-[1.5px] border-border-subtle bg-glass px-4 py-2 text-xs font-semibold text-primary shadow-card transition-opacity duration-200 ${
          pickingPoint !== null ? "opacity-100" : "opacity-0"
        }`}
      >
        Click the map to set {pickingPoint ?? "a point"} — click the highlighted button again to
        cancel
      </div>
    </div>
  );
}
