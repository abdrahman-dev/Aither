export type HeatRiskLevel = "low" | "moderate" | "high" | "critical";

// Stub — filled in as Phase 2+ implements the real FortyGuard/ORS integration.
export type RouteRiskResult = {
  routeId: string;
  riskScore: number;
  riskLevel: HeatRiskLevel;
  // Phase 2+: per-segment scores, peak/exceedance/persistence terms, and
  // route heat-exposure comparison fields land here.
};