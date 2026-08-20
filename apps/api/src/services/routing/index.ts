import { config } from "../../config";
import { OpenRouteServiceClient } from "./client";

export { OpenRouteServiceClient } from "./client";
export { RoutingError } from "./errors";
export {
  ORS_BASE_URL,
  DEFAULT_ROUTING_PROFILE
} from "./client";
export * from "./types";

// The single shared client; API key stays backend-only (AGENTS.md §11).
export const orsClient = new OpenRouteServiceClient(config.orsApiKey);