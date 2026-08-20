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