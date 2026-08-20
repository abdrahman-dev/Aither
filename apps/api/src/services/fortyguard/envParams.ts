import { FortyGuardClient } from "./client";
import { FortyGuardError } from "./errors";
import {
  ENV_PARAMS_ANALYSES,
  type EnvParamsOptions,
  type EnvParamsResultRaw,
  type NormalizedEnvParams
} from "./types";

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  // null / missing stays unavailable, never coerced to 0 (AGENTS.md §13).
  return null;
}

// Per-sample nulls inside arrays are preserved as unavailable, never 0.
function normalizeParameterValue(value: unknown): Array<number | null> {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === "number" && Number.isFinite(entry) ? entry : null
    );
  }
  const scalar = toNumberOrNull(value);
  return scalar === null ? [null] : [scalar];
}

export function normalizeEnvParams(activityId: string, result: EnvParamsResultRaw): NormalizedEnvParams {
  const metadata = result.metadata;
  const locations = (result.locations ?? []).map((location) => {
    const parameters: Record<string, Array<number | null>> = {};
    for (const [name, value] of Object.entries(location.parameters ?? {})) {
      parameters[name] = normalizeParameterValue(value);
    }

    let solarIrradiance: NormalizedEnvParams["locations"][number]["solarIrradiance"] = null;
    if (location.solar_irradiance) {
      solarIrradiance = {
        clearSky: {
          ghi: toNumberOrNull(location.solar_irradiance.clear_sky.ghi) ?? 0,
          dni: toNumberOrNull(location.solar_irradiance.clear_sky.dni) ?? 0,
          dhi: toNumberOrNull(location.solar_irradiance.clear_sky.dhi) ?? 0
        },
        description: location.solar_irradiance.description
      };
    }

    return {
      lat: toNumberOrNull(location.lat) ?? 0,
      lon: toNumberOrNull(location.lon) ?? 0,
      elevation: toNumberOrNull(location.elevation),
      temperature: toNumberOrNull(location.temperature),
      parameters,
      solarIrradiance
    };
  });

  return {
    activityId,
    metadata: {
      timezone: metadata?.timezone ?? "",
      timezoneOffsetHours: toNumberOrNull(metadata?.timezone_offset_hours),
      timeRange: {
        start: metadata?.time_range?.start ?? "",
        end: metadata?.time_range?.end ?? "",
        interval: metadata?.time_range?.interval,
        count: metadata?.time_range?.count === undefined
          ? undefined
          : toNumberOrNull(metadata.time_range.count) ?? undefined
      },
      timestamps: metadata?.timestamps ?? []
    },
    locations
  };
}

/**
 * POST /v1/env_params then poll until completion. Validates the analysis
 * subset against the 17 accepted names before sending (the reference client
 * does the same). No count cap is enforced. Pass wait=false to receive only
 * the activity_id.
 */
export async function environmentalParameters(
  client: FortyGuardClient,
  options: EnvParamsOptions
): Promise<NormalizedEnvParams | string> {
  const requested = [...(options.analysis ?? [])];
  const unknown = requested.filter((name) => !ENV_PARAMS_ANALYSES.includes(name));
  if (unknown.length > 0) {
    throw new FortyGuardError(
      `Unknown env-params analysis ${JSON.stringify(unknown)}. Valid options: ${ENV_PARAMS_ANALYSES.join(", ")}`
    );
  }

  const dateTime: Record<string, unknown> = {
    start_date: options.startDate,
    filter_type: options.filterType
  };
  if (options.startTime !== undefined) dateTime.start_time = options.startTime;
  if (options.endTime !== undefined) dateTime.end_time = options.endTime;
  if (options.endDate !== undefined) dateTime.end_date = options.endDate;

  const payload: Record<string, unknown> = {
    latitude: options.latitude,
    longitude: options.longitude,
    temperature: options.temperature,
    date_time: dateTime
  };
  if (requested.length > 0) {
    payload.analysis = requested;
  }

  const activityId = await client.submit("/v1/env_params", payload);
  console.log(`env_params activity submitted activityId=${activityId}`);

  if (options.wait === false) {
    return activityId;
  }

  const result = await client.waitForActivity<EnvParamsResultRaw>(activityId, {
    pollIntervalSeconds: options.pollIntervalSeconds,
    timeoutSeconds: options.timeoutSeconds
  });

  if (!result?.locations || !Array.isArray(result.locations)) {
    throw new FortyGuardError("env_params activity completed without locations.");
  }

  return normalizeEnvParams(activityId, result);
}