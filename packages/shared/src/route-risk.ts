export type HeatRiskLevel = "low" | "moderate" | "high" | "critical";

// The backend-owned Phase 2 route-heat comparison result shape lives in
// apps/api/src/services/heat/routeAnalysis.ts (CompareRouteResult). Keep the
// shared risk vocabulary here; do not duplicate the full result type.