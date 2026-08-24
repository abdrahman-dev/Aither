// Success-body view of the wire envelope defined by @aither/shared's
// ApiEnvelope (data is T | null there; after the !ok check below it is
// always present, so this local view narrows data to T).
export type ApiEnvelope<T> = {
  error: boolean;
  message: string;
  data: T;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_BASE_URL = "http://localhost:3000";

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // The frontend talks to Aither's own backend only (AGENTS.md §24). FortyGuard
    // and routing-provider keys never exist in the frontend, so this wrapper
    // never addresses external providers directly.
    this.baseUrl = (baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  get<T>(path: string): Promise<ApiEnvelope<T>> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new ApiError(0, "Network request failed. Please try again.");
    }

    if (!response.ok) {
      throw new ApiError(response.status, await this.readErrorMessage(response));
    }

    const envelope = (await response.json()) as ApiEnvelope<T>;
    return envelope;
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const envelope = (await response.json()) as Partial<ApiEnvelope<unknown>>;
      if (typeof envelope.message === "string") {
        return envelope.message;
      }
    } catch {
      // Non-JSON error body; fall through to the generic message.
    }
    return `Request failed with status ${response.status}`;
  }
}

export const api = new ApiClient();