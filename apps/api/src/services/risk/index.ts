export type SegmentRiskInput = {
  normalizedPeakTemperature: number;
  normalizedExceedance: number;
  normalizedPersistence: number;
};

export type SegmentRiskScore = number;

/**
 * D1 risk scoring formula — see Aither_Development_Phase_0_5.md §4 D1.
 *
 *   segmentRiskScore =
 *     (0.3 × normalizedPeakTemperature)
 *   + (0.4 × normalizedExceedance)
 *   + (0.3 × normalizedPersistence)
 *
 * All three inputs are normalized 0–1 relative to the routes being compared
 * (not on an absolute scale). This is only the typed signature; the
 * implementation and normalization land in Phase 2.
 */
export function segmentRiskScore(input: SegmentRiskInput): SegmentRiskScore {
  void input;
  throw new Error("segmentRiskScore is not implemented until Phase 2");
}