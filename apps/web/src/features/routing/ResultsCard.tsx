import type { HeatRiskLevel, RouteRiskData } from "@aither/shared";
import type { ResultContext } from "./useTripPlanning";

type ResultsCardProps = {
  result: RouteRiskData;
  onDismiss: () => void;
  /** Trip context (date/window/mode) the analysis was run against. */
  context?: ResultContext | null;
};

// §2.4 badge pairs (background / text). No distinct "critical" token exists in
// the guidelines, so critical reuses the high pair.
const RISK_BADGE_CLASSES: Record<HeatRiskLevel, string> = {
  low: "bg-risk-low text-risk-low-text",
  moderate: "bg-risk-moderate text-risk-moderate-text",
  high: "bg-risk-high text-risk-high-text",
  critical: "bg-risk-high text-risk-high-text"
};

const riskPillClass =
  "rounded-pill px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide";

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function formatWindow(result: RouteRiskData): string {
  const start = result.timeWindow.startTime ?? "00:00";
  const end = result.timeWindow.endTime ?? "23:59";
  return `${start}–${end} · threshold ${result.threshold}°C (${result.direction})`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-map-base/70 px-2 py-1.5">
      <dt className="text-[9px] font-bold uppercase tracking-wide text-tertiary">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-extrabold tabular-nums text-primary">{value}</dd>
    </div>
  );
}

export default function ResultsCard({ result, onDismiss, context = null }: ResultsCardProps) {
  const recommendedIndex = result.recommendation
    ? result.routes.findIndex((route) => route.routeId === result.recommendation?.routeId)
    : -1;

  const tradeoff = result.tradeoff?.recommendedVsFastest;

  return (
    <section className="rounded-panel border-[1.5px] border-border-subtle bg-glass-soft p-5 shadow-card backdrop-blur-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-tertiary">
            Analysis result
          </p>
          <h2 className="mt-0.5 text-base font-extrabold leading-tight text-primary">
            Heat comparison
          </h2>
          <p className="mt-0.5 text-xs text-secondary">{formatWindow(result)}</p>
          {context && (
            <p className="mt-1 text-[11px] leading-relaxed text-tertiary">
              Measured conditions for {context.date} · {context.windowLabel} ·{" "}
              {context.modeLabel.toLowerCase()}  not a forecast.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss results"
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-tertiary transition hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          ✕
        </button>
      </div>

      {result.recommendation && recommendedIndex >= 0 && (
        <div className="mt-4 rounded-control border border-risk-low-text/25 bg-success-highlight p-3.5">
          <span className="inline-block rounded-pill bg-brand-gradient px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-button-primary">
            ★ Recommended  Route {recommendedIndex + 1}
          </span>
          <p className="mt-2 text-sm font-extrabold leading-snug text-primary">
            {result.recommendation.basis}
          </p>
          {tradeoff && (
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-secondary">
              +{tradeoff.extraMinutes} min · +{formatDistance(tradeoff.extraDistanceMeters)} ·{" "}
              {tradeoff.heatExposureReductionPercent !== null
                ? `${tradeoff.heatExposureReductionPercent}% less estimated heat exposure`
                : "comparable estimated heat exposure"}
            </p>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-2.5">
        {result.routes.map((route, index) => {
          const isRecommended = index === recommendedIndex;
          return (
            <li
              key={route.routeId}
              className={
                isRecommended
                  ? "rounded-control border-[1.5px] border-brand bg-surface p-3.5 shadow-card"
                  : "rounded-control border-[1.5px] border-border-subtle bg-surface p-3.5"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-primary">Route {index + 1}</span>
                {route.risk ? (
                  <span className={`${riskPillClass} ${RISK_BADGE_CLASSES[route.risk.level]}`}>
                    {route.risk.level} risk
                  </span>
                ) : (
                  <span className={`${riskPillClass} bg-border-subtle text-tertiary`}>
                    no heat data
                  </span>
                )}
              </div>

              <dl className="mt-2.5 grid grid-cols-4 gap-1.5">
                <Stat label="Dist" value={formatDistance(route.summary.distanceMeters)} />
                <Stat label="Time" value={formatDuration(route.summary.durationSeconds)} />
                <Stat label="Score" value={route.risk ? route.risk.score.toFixed(2) : "—"} />
                <Stat
                  label="Peak"
                  value={route.heat ? `${route.heat.peakTemperatureC.toFixed(1)}°` : "—"}
                />
              </dl>

              {route.risk && route.heat ? (
                <p className="mt-2 text-xs text-secondary">
                  {route.heat.exceedanceHours.toFixed(1)} h over threshold ·{" "}
                  {route.heat.persistenceHours.toFixed(1)} h sustained heat
                </p>
              ) : (
                <p className="mt-2 text-xs italic text-tertiary">
                  Route could not be matched to enough heat samples.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {result.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border-subtle pt-3">
          {result.warnings.map((warning) => (
            <li key={warning} className="px-1 text-xs leading-relaxed text-tertiary">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
