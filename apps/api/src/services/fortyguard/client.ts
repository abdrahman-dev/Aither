import { ActivityNotReadyError, FortyGuardError, TaskFailedError, TaskTimeoutError } from "./errors";
import type { ActivityStatusData, FortyGuardEnvelope } from "./types";

export type WaitForActivityOptions = {
  pollIntervalSeconds?: number;
  timeoutSeconds?: number;
};

// Terminal statuses are matched case-insensitively (AGENTS.md §12).
const TERMINAL_SUCCESS = new Set(["completed", "succeeded"]);
const TERMINAL_FAILURE = new Set(["failed", "error"]);

export const DEFAULT_POLL_INTERVAL_SECONDS = 3;
export const DEFAULT_POLL_TIMEOUT_SECONDS = 600;
export const DEFAULT_HTTP_TIMEOUT_MS = 60_000;
export const PROGRESS_LOG_INTERVAL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Connection-level failures (ECONNRESET/ECONNABORTED/timeouts, fetch throwing
// "fetch failed") are transient by nature — the poll loop retries them with
// backoff rather than aborting the whole request (AGENTS.md §12).
export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const details = error as Error & { name?: string; code?: string; cause?: { code?: string } };
  const causeCode = typeof details.cause?.code === "string" ? details.cause.code : "";
  const transientCodes = new Set([
    "ECONNRESET",
    "ECONNABORTED",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT"
  ]);
  if (
    details.name === "AbortError" ||
    transientCodes.has(details.code ?? "") ||
    transientCodes.has(causeCode)
  ) {
    return true;
  }
  return /fetch failed|write aborted|socket hang up|connection (reset|refused|closed)|network/i.test(
    details.message ?? ""
  );
}

// The abort timer stays armed until the response body is consumed, so the
// connect/headers/body phases are all bounded by the same timeout.
type TimedFetch = {
  response: Response;
  readJson: () => Promise<unknown>;
  readText: () => Promise<string>;
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<TimedFetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return {
      response,
      readJson: () => response.json().finally(() => clearTimeout(timer)),
      readText: () => response.text().finally(() => clearTimeout(timer))
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * Thin HTTP wrapper around the FortyGuard API (AGENTS.md §9, §19). Activity
 * submit + status polling lives here so no other module knows about the
 * asynchronous activity contract (AGENTS.md §12).
 */
export class FortyGuardClient {
  private readonly baseUrl: string;
  private readonly httpTimeoutMs: number;

  constructor(private readonly apiKey: string, baseUrl: string, httpTimeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.httpTimeoutMs = httpTimeoutMs;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { response, readJson, readText } = await fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        method,
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      },
      this.httpTimeoutMs
    );

    if (!response.ok) {
      throw new FortyGuardError(
        `${method} ${path} -> ${response.status}: ${(await readText()).slice(0, 500)}`
      );
    }

    try {
      return (await readJson()) as T;
    } catch (error) {
      if (isTransientNetworkError(error)) {
        throw error;
      }
      throw new FortyGuardError(`${method} ${path} returned a non-JSON body.`);
    }
  }

  /** POST an analysis payload and return the created activity_id. */
  async submit(path: string, payload: unknown): Promise<string> {
    const body = await this.request<FortyGuardEnvelope<unknown> | null>("POST", path, payload);
    if (!body || typeof body !== "object" || body.error) {
      throw new FortyGuardError(body?.message ?? "Submission failed");
    }
    const data = body.data as { activity_id?: unknown } | null | undefined;
    if (!data || typeof data.activity_id !== "string" || data.activity_id === "") {
      throw new FortyGuardError(`Unexpected submission response shape: ${JSON.stringify(body)}`);
    }
    return data.activity_id;
  }

  /** GET /v1/status/{activity_id}. 404 and transient network errors are retryable. */
  async getStatus<T>(activityId: string): Promise<ActivityStatusData<T>> {
    const path = `/v1/status/${activityId}`;
    const { response, readJson, readText } = await fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        method: "GET",
        headers: { "api-key": this.apiKey }
      },
      this.httpTimeoutMs
    );

    if (response.status === 404) {
      // Eventual consistency right after submission, not a failure.
      throw new ActivityNotReadyError(activityId);
    }
    if (!response.ok) {
      throw new FortyGuardError(
        `GET ${path} -> ${response.status}: ${(await readText()).slice(0, 500)}`
      );
    }

    let body: FortyGuardEnvelope<ActivityStatusData<T>>;
    try {
      body = (await readJson()) as FortyGuardEnvelope<ActivityStatusData<T>>;
    } catch (error) {
      if (isTransientNetworkError(error)) {
        throw error;
      }
      throw new FortyGuardError(`GET ${path} returned a non-JSON body.`);
    }
    if (!body || typeof body !== "object" || body.error) {
      throw new FortyGuardError(body?.message ?? "Status lookup failed");
    }
    if (body.data === null || typeof body.data !== "object") {
      throw new FortyGuardError(`GET ${path} returned an unexpected response shape.`);
    }
    return body.data;
  }

  /**
   * Poll until the activity terminates (case-insensitive), returning the
   * result payload. Mirrors reference defaults: poll_interval 3 s, timeout
   * 600 s. A brief 404 right after submission is retried, not failed.
   */
  async waitForActivity<T>(activityId: string, options: WaitForActivityOptions = {}): Promise<T> {
    const pollIntervalMs = (options.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
    const timeoutMs = (options.timeoutSeconds ?? DEFAULT_POLL_TIMEOUT_SECONDS) * 1000;
    const deadline = Date.now() + timeoutMs;
    // Transient network failures retry with exponential backoff capped at the
    // poll cadence; the overall deadline still enforces a hard stop.
    const maxTransientBackoffMs = Math.max(pollIntervalMs, 1_000);
    let transientBackoffMs = 1_000;

    while (true) {
      let data: ActivityStatusData<T>;
      try {
        data = await this.getStatus<T>(activityId);
      } catch (error) {
        if (error instanceof ActivityNotReadyError) {
          if (Date.now() >= deadline) {
            throw new TaskTimeoutError(
              `Activity ${activityId} never became visible within ${timeoutMs / 1000}s`
            );
          }
          await sleep(pollIntervalMs);
          continue;
        }
        if (!isTransientNetworkError(error)) {
          throw error;
        }
        if (Date.now() >= deadline) {
          throw new TaskTimeoutError(
            `Activity ${activityId} status polling kept failing transiently for ${timeoutMs / 1000}s`
          );
        }
        await sleep(transientBackoffMs);
        transientBackoffMs = Math.min(transientBackoffMs * 2, maxTransientBackoffMs);
        continue;
      }

      // Reset backoff after a successful status read.
      transientBackoffMs = 1_000;

      const normalized = String(data.status ?? "").toLowerCase();

      if (TERMINAL_SUCCESS.has(normalized)) {
        console.log(`Activity ${activityId} completed status=${normalized}`);
        return (data.result ?? data) as T;
      }
      if (TERMINAL_FAILURE.has(normalized)) {
        throw new TaskFailedError(
          `Activity ${activityId} failed: ${data.message ?? JSON.stringify(data)}`
        );
      }
      if (Date.now() >= deadline) {
        throw new TaskTimeoutError(
          `Activity ${activityId} still '${data.status}' after ${timeoutMs / 1000}s`
        );
      }
      await sleep(pollIntervalMs);
    }
  }
}