import { RoutingError } from "./errors";
import type {
  DirectionsOptions,
  DirectionsResult,
  NormalizedRoute,
  OrsDirectionsResponse
} from "./types";

export const ORS_BASE_URL = "https://api.openrouteservice.org";
export const DEFAULT_ROUTING_PROFILE = "foot-walking";
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toFiniteNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new RoutingError(`ORS directions response missing ${field}.`);
}

function normalizeDirections(response: OrsDirectionsResponse, profile: string): DirectionsResult {
  const features = Array.isArray(response.features) ? response.features : [];
  if (features.length === 0) {
    throw new RoutingError(`ORS directions returned no routes for profile '${profile}'.`);
  }

  const routes: NormalizedRoute[] = features.map((feature, index) => {
    const geometry = feature?.geometry;
    if (
      !geometry ||
      geometry.type !== "LineString" ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2
    ) {
      throw new RoutingError(
        "ORS directions response contained a route without a usable LineString geometry."
      );
    }

    const summary = feature.properties?.summary ?? {};
    return {
      routeId: String(index),
      geometry,
      summary: {
        distanceMeters: toFiniteNumber(summary.distance, `routes[${index}].summary.distance`),
        durationSeconds: toFiniteNumber(summary.duration, `routes[${index}].summary.duration`)
      }
    };
  });

  return { routes, warnings: [] };
}

/**
 * OpenRouteService Directions client. Uses the official /geojson variant of
 * POST /v2/directions/{profile} (same request body; LineString coordinates come
 * back directly, no encoded-polyline decoding needed). Authorization header is
 * the raw key (not "Bearer"). Coordinates are [longitude, latitude] pairs.
 */
export class OpenRouteServiceClient {
  private readonly baseUrl: string;
  private readonly httpTimeoutMs: number;

  constructor(private readonly apiKey: string, baseUrl = ORS_BASE_URL, httpTimeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.httpTimeoutMs = httpTimeoutMs;
  }

  async directions(coordinates: number[][], options: DirectionsOptions = {}): Promise<DirectionsResult> {
    const profile = options.profile ?? DEFAULT_ROUTING_PROFILE;

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new RoutingError("Directions require at least two [longitude, latitude] coordinates.");
    }
    for (const point of coordinates) {
      if (
        !Array.isArray(point) ||
        point.length < 2 ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1])
      ) {
        throw new RoutingError("Directions coordinates must be finite [longitude, latitude] pairs.");
      }
    }

    // Profile lives in the URL; the body carries coordinates + routing options.
    const body: Record<string, unknown> = { coordinates };
    if (options.preference !== undefined) {
      body.preference = options.preference;
    }
    if (options.alternativeRoutes !== false) {
      body.alternative_routes = {
        target_count: options.alternativeRoutes?.targetCount ?? 3,
        share_factor: options.alternativeRoutes?.shareFactor ?? 0.6,
        weight_factor: options.alternativeRoutes?.weightFactor ?? 1.4
      };
    }

    const path = `/v2/directions/${profile}/geojson`;
    try {
      const response = await this.postJson(path, body);
      return normalizeDirections(response, profile);
    } catch (error) {
      // Alternatives are not always available; retry once without them rather
      // than failing the whole routing request.
      if (options.alternativeRoutes !== false && error instanceof RoutingError) {
        console.log(`ORS directions alternatives failed for profile ${profile}; retrying without them.`);
        const fallbackBody: Record<string, unknown> = { coordinates };
        if (options.preference !== undefined) {
          fallbackBody.preference = options.preference;
        }
        const response = await this.postJson(path, fallbackBody);
        const result = normalizeDirections(response, profile);
        result.warnings.push("Alternative routes were not available; a single route was returned.");
        return result;
      }
      throw error;
    }
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<OrsDirectionsResponse> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      this.httpTimeoutMs
    );

    if (!response.ok) {
      throw new RoutingError(
        `POST ${path} -> ${response.status}: ${(await response.text()).slice(0, 500)}`
      );
    }

    try {
      return (await response.json()) as OrsDirectionsResponse;
    } catch {
      throw new RoutingError(`POST ${path} returned a non-JSON body.`);
    }
  }
}