/**
 * Error taxonomy mirrors the vendored reference client (exceptions.py).
 */
export class FortyGuardError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FortyGuardError";
  }
}

export class ActivityNotReadyError extends FortyGuardError {
  readonly activityId: string;

  constructor(activityId: string) {
    super(
      `Activity ${activityId} is not visible yet (status endpoint returned 404).`
    );
    this.name = "ActivityNotReadyError";
    this.activityId = activityId;
  }
}

export class TaskFailedError extends FortyGuardError {
  constructor(message: string) {
    super(message);
    this.name = "TaskFailedError";
  }
}

export class TaskTimeoutError extends FortyGuardError {
  constructor(message: string) {
    super(message);
    this.name = "TaskTimeoutError";
  }
}

/**
 * Message for the "area is covered but nothing is published for this date"
 * case: observed live on 2026-08-23 where identical Arizona requests completed
 * empty for the current day while returning full data for past dates.
 */
export const NO_DATA_FOR_DATE_MESSAGE =
  "No heat data is available yet for this date and location — try a date at least a day or two in the past.";

/**
 * Thrown when a FortyGuard activity completes successfully but returns
 * no usable data (no tile features AND statistics carrying no numeric values —
 * stats_data may still be present with marker keys only).
 *
 * The response body alone cannot distinguish a genuinely uncovered area
 * (e.g., non-U.S.) from a covered area whose data does not exist yet for the
 * requested date, so callers choose the message; the default covers the
 * out-of-coverage case.
 */
export class NoCoverageError extends FortyGuardError {
  constructor(
    message = "No heat data available for this location. Coverage is currently limited to the United States."
  ) {
    super(message);
    this.name = "NoCoverageError";
  }
}