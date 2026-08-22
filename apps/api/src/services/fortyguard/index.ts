import { config } from "../../config";
import { FortyGuardClient } from "./client";

export { FortyGuardClient } from "./client";
export {
  ActivityNotReadyError,
  FortyGuardError,
  NoCoverageError,
  TaskFailedError,
  TaskTimeoutError
} from "./errors";
export {
  createHeatmap,
  normalizeHeatmap
} from "./heatmap";
export {
  environmentalParameters,
  normalizeEnvParams
} from "./envParams";
export * from "./types";

// The single shared client; API key stays backend-only (AGENTS.md §11).
export const fortyGuardClient = new FortyGuardClient(
  config.fortyguardApiKey,
  config.fortyguardBaseUrl
);