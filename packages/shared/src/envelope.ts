/**
 * Wire envelope used by every Aither API endpoint, success and error alike.
 *
 * Success: { error: false, message: string, data: T }
 * Error:   { error: true,  message: string, data: null }
 */
export type ApiEnvelope<T> = {
  error: boolean;
  message: string;
  /** null on every error response; present on success. */
  data: T | null;
};

/** Shape of an error response body (data is always null). */
export type ApiErrorBody = ApiEnvelope<null>;
