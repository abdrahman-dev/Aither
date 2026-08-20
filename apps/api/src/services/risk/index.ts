import type { HeatRiskLevel } from "@aither/shared";

export type SegmentRiskInput = {
  normalizedPeakTemperature: number;
  normalizedExceedance: number;
  normalizedPersistence: number;
};

export type SegmentRiskScore = number;

// Project parameters (AGENTS.md §15): fixed D1 weights.
const WEIGHTS = {
  peak: 0.3,
  exceedance: 0.4,
  persistence: 0.3
} as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * D1 risk scoring formula — see Aither_Development_Phase_0_5.md §4 D1.
 *
 *   segmentRiskScore =
 *     (0.3 × normalizedPeakTemperature)
 *   + (0.4 × normalizedExceedance)
 *   + (0.3 × normalizedPersistence)
 *
 * All three inputs are normalized 0–1 relative to the routes being compared
 * (not on an absolute scale). Inputs are clamped to [0, 1]; the output is
 * clamped to [0, 1] so it is comparable across route sets.
 */
export function segmentRiskScore(input: SegmentRiskInput): SegmentRiskScore {
  const peak = clamp01(input.normalizedPeakTemperature);
  const exceedance = clamp01(input.normalizedExceedance);
  const persistence = clamp01(input.normalizedPersistence);
  return clamp01(
    WEIGHTS.peak * peak + WEIGHTS.exceedance * exceedance + WEIGHTS.persistence * persistence
  );
}

/**
 * Min-max normalization relative to the values being compared (D1). Returns
 * NaN for non-finite inputs; when the compared values are all equal, 0.5 is
 * used as the neutral midpoint so the term neither dominates nor vanishes.
 */
export function normalizeRelative(values: readonly number[]): number[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return values.map(() => Number.NaN);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of finite) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const range = max - min;
  if (range <= 0) {
    return values.map((value) => (Number.isFinite(value) ? 0.5 : Number.NaN));
  }
  return values.map((value) =>
    Number.isFinite(value) ? (value - min) / range : Number.NaN
  );
}

// Project thresholds (provisional labels, AGENTS.md §15).
export function classifyRiskScore(score: number): HeatRiskLevel {
  if (score >= 0.75) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.25) return "moderate";
  return "low";
}