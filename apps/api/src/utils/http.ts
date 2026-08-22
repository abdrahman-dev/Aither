import type { Response } from "express";
import { FortyGuardError, NoCoverageError } from "../services/fortyguard/errors";
import { RoutingError } from "../services/routing/errors";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function sendOk<T>(res: Response, message: string, data: T): void {
  res.json({ error: false, message, data });
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: true, message, data: null });
}

/**
 * Map service errors to user-facing responses. External-provider errors stay
 * lightweight and never leak raw API text or infrastructure details
 * (AGENTS.md §9.6, §25, §59).
 */
export function handleServiceError(res: Response, error: unknown): void {
  if (error instanceof HttpError) {
    sendError(res, error.status, error.message);
    return;
  }
  console.error(error);
  if (error instanceof NoCoverageError) {
    // D3: out-of-coverage is a normal user-facing state, not a crash.
    // Surface a lightweight, non-technical message.
    sendError(res, 502, error.message);
    return;
  }
  if (error instanceof FortyGuardError) {
    sendError(
      res,
      502,
      "Heat data is temporarily unavailable for this area. Please try again or choose a different location."
    );
    return;
  }
  if (error instanceof RoutingError) {
    sendError(res, 502, "Route data is temporarily unavailable. Please try again.");
    return;
  }
  sendError(res, 500, "An unexpected error occurred. Please try again.");
}