import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type {
  Coordinates,
  RouteRiskApiResponse,
  RouteRiskData,
  RouteRiskRequest
} from "@aither/shared";
import { api, ApiError } from "../../api/client";
import type { LocationStatus, PickTarget, ResultContext, RouteProfile } from "./useTripPlanning";
// Vite's asset pipeline resolves this at build time (typed via vite/client).
import logoUrl from "../../assets/AitherLogo.png";

// ORS profiles accepted by POST /api/route-risk (backend defaults foot-walking).
const PROFILE_OPTIONS: { value: RouteProfile; label: string }[] = [
  { value: "foot-walking", label: "Walking" },
  { value: "driving-car", label: "Driving" },
  { value: "cycling-regular", label: "Cycling" }
];

function modeLabel(profile: RouteProfile): string {
  return PROFILE_OPTIONS.find((option) => option.value === profile)?.label ?? profile;
}

// FortyGuard contract floor (AGENTS.md §9.2): earlier dates fail upstream.
const DATE_FLOOR = "2021-01-01";

// FortyGuard publishes TCM data with processing latency: same-day requests
// routinely complete with no data while past dates return full results
// (confirmed live 2026-08-23). Default a few days back so first-time users get
// real data; today stays selectable in the picker.
const DEFAULT_DATE_DAYS_BACK = 3;

function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function defaultDateInput(): string {
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - DEFAULT_DATE_DAYS_BACK);
  return toDateInputValue(fallback);
}

// D4 (Phase_0_5 §4): past hours of today only  no future dates or times.
function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatCoordinates(point: Coordinates): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

type Feedback = { tone: "success" | "error"; text: string };

const labelClass = "mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-secondary";

const neutralInputClass =
  "w-full rounded-control border-[1.5px] border-border-subtle bg-surface px-3 py-2 text-sm text-primary transition-colors hover:border-tertiary/50 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

// §4 focus behavior: origin #38BDF8, destination #34D399; date/time inputs use
// the documented gradient midpoint #0EA5E9 as their neutral focus color.
const neutralFocusClass = "focus:border-brand-mid focus:ring-brand-mid/20";

// Tiny presentational icons for field labels; rendered via pure SVG in
// existing §2 palette colors  no new dependencies (AGENTS §33).
function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

function FieldLabel({
  children,
  icon,
  id,
  htmlFor
}: {
  children: string;
  icon: ReactNode;
  id?: string;
  htmlFor?: string;
}) {
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={labelClass} id={id}>
      {content}
    </label>
  ) : (
    <span className={labelClass} id={id}>
      {content}
    </span>
  );
}

const originIcon = (
  <Icon className="text-brand">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);

const destinationIcon = (
  <Icon className="text-brand-secondary">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </Icon>
);

const routeIcon = (
  <Icon>
    <circle cx="6" cy="19" r="3" />
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    <circle cx="18" cy="5" r="3" />
  </Icon>
);

const calendarIcon = (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </Icon>
);

const clockIcon = (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);

// Thin brand-gradient accent bar shared by expanded and collapsed panel
// states  a single ReactNode reused at mount time (only one mounts at a
// time, so React allows the same instance).
const panelTopBar = (
  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
);

type StepState = "done" | "current" | "pending";

function StepStrip({
  originSet,
  destinationSet,
  hasResult,
  busy
}: {
  originSet: boolean;
  destinationSet: boolean;
  hasResult: boolean;
  busy: boolean;
}) {
  // Step 3 is always satisfied (the date input defaults to a recent past day
  // with real data), so progress reads: set points → compare.
  const definitions: { n: number; label: string; state: StepState }[] = [
    { n: 1, label: "Origin", state: originSet ? "done" : "current" },
    {
      n: 2,
      label: "Destination",
      state: destinationSet ? "done" : originSet ? "current" : "pending"
    },
    { n: 3, label: "Date & time", state: destinationSet ? "done" : "pending" },
    {
      n: 4,
      label: "Compare",
      state: hasResult ? "done" : destinationSet || busy ? "current" : "pending"
    }
  ];

  return (
    <ol className="flex items-start gap-1.5" aria-label="Planning steps">
      {definitions.map((step, index) => {
        const nextState = definitions[index + 1]?.state;
        return (
          <li key={step.n} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <span
                className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                  step.state === "done"
                    ? "bg-brand-secondary text-white aither-step-pop"
                    : step.state === "current"
                      ? "bg-surface text-brand-mid ring-[1.5px] ring-inset ring-brand-mid"
                      : "bg-border-subtle text-tertiary"
                }`}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                {step.state === "current" && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-full bg-brand/30"
                  />
                )}
                <span className="relative">{step.state === "done" ? "✓" : step.n}</span>
              </span>
              {nextState !== undefined && (
                <span
                  aria-hidden="true"
                  className={`h-[2px] flex-1 rounded-full ${
                    nextState === "pending" ? "bg-border-subtle" : "bg-brand-gradient"
                  }`}
                />
              )}
            </div>
            <span
              className={`text-center text-[10px] font-bold leading-tight tracking-wide ${
                step.state === "pending" ? "text-tertiary" : "text-secondary"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PulsingDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span
        aria-hidden="true"
        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60"
      />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
    </span>
  );
}

function PointPickerButton({
  target,
  number,
  point,
  armed,
  disabled,
  idleDiscClass,
  armedButtonClass,
  onTogglePick
}: {
  target: PickTarget;
  number: string;
  point: Coordinates | null;
  armed: boolean;
  disabled: boolean;
  /** Icon-disc styling while idle/set (tinted background + accent text). */
  idleDiscClass: string;
  /** Full button styling while armed (accent border/tint/text). */
  armedButtonClass: string;
  onTogglePick: (target: PickTarget) => void;
}) {
  const base =
    "flex w-full items-center gap-3 rounded-control border-[1.5px] px-3.5 py-3 text-left text-sm shadow-top-bar transition hover:border-brand-mid/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60";

  const disc = (
    <span
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${idleDiscClass}`}
    >
      {armed && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-current opacity-20"
        />
      )}
      <span className="relative">{point && !armed ? "✓" : number}</span>
    </span>
  );

  let body;
  if (armed) {
    body = (
      <>
        {disc}
        <span className="flex-1 font-semibold">Click the map to drop this point…</span>
        <PulsingDot />
      </>
    );
  } else if (point) {
    body = (
      <>
        {disc}
        <span className="flex-1">
          <span className="block font-semibold tabular-nums text-primary">
            {formatCoordinates(point)}
          </span>
          <span className="block text-xs text-tertiary">tap to change</span>
        </span>
      </>
    );
  } else {
    body = (
      <>
        {disc}
        <span className="flex-1 font-semibold text-secondary">Pick {target} on map</span>
        <span aria-hidden="true" className="text-lg leading-none text-tertiary">
          ›
        </span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onTogglePick(target)}
      aria-pressed={armed}
      disabled={disabled}
      className={`${base} ${armed ? armedButtonClass : "border-border-subtle bg-surface"}`}
    >
      {body}
    </button>
  );
}

type RoutePlannerProps = {
  origin: Coordinates | null;
  destination: Coordinates | null;
  pickingTarget: PickTarget | null;
  onTogglePick: (target: PickTarget) => void;
  /** Hands a successful comparison payload up so the map and results render it. */
  onPublishResult: (result: RouteRiskData, context: ResultContext) => void;
  /** A published comparison exists  collapse into a compact summary until edited. */
  hasResult: boolean;
  /** One-shot device location request; success sets the origin + blue dot. */
  onUseCurrentLocation: () => void;
  locationStatus: LocationStatus;
};

export default function RoutePlanner({
  origin,
  destination,
  pickingTarget,
  onTogglePick,
  onPublishResult,
  hasResult,
  onUseCurrentLocation,
  locationStatus
}: RoutePlannerProps) {
  const [dateInput, setDateInput] = useState(defaultDateInput);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [profileInput, setProfileInput] = useState<RouteProfile>("foot-walking");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Publish collapses the form into a summary; dismissing the results card
  // brings the full planner back.
  useEffect(() => {
    setExpanded(!hasResult);
  }, [hasResult]);

  // Recomputed on render so the D4 caps track the current moment while the
  // user is filling in the form (no timers  good enough for picker bounds).
  const todayDate = toDateInputValue(new Date());
  const nowTime = toTimeInputValue(new Date());
  const isToday = dateInput === todayDate;

  function buildRequest(): RouteRiskRequest | string {
    if (!origin) {
      return "Pick an origin point on the map first.";
    }
    if (!destination) {
      return "Pick a destination point on the map first.";
    }
    if (origin.latitude === destination.latitude && origin.longitude === destination.longitude) {
      return "Origin and destination must be different.";
    }

    if (dateInput === "") {
      return "Pick a date for the analysis.";
    }
    if (dateInput < DATE_FLOOR) {
      return `Date cannot be before ${DATE_FLOOR}.`;
    }
    if (dateInput > todayDate) {
      return "Aither analyzes measured conditions only  future dates are not supported.";
    }

    // FROM anchors the analysis window and is required; TO falls back to the
    // backend's whole-day default when omitted. Failing here returns before
    // any loading state is touched, so submit can never stick.
    if (startTimeInput === "") {
      return "Pick a start time for the analysis.";
    }

    // Today's analysis window may only cover hours that have already passed.
    if (isToday && startTimeInput !== "" && startTimeInput > nowTime) {
      return `Start time is later than it is now (${nowTime})  only past hours of today can be analyzed.`;
    }
    if (isToday && endTimeInput !== "" && endTimeInput > nowTime) {
      return `End time is later than it is now (${nowTime})  only past hours of today can be analyzed.`;
    }
    if (startTimeInput !== "" && endTimeInput !== "" && endTimeInput <= startTimeInput) {
      return "End time must be after start time.";
    }

    return {
      origin,
      destination,
      date: dateInput,
      profile: profileInput,
      ...(startTimeInput !== "" ? { startTime: startTimeInput } : {}),
      ...(endTimeInput !== "" ? { endTime: endTimeInput } : {})
    };
  }

  function resultContext(): ResultContext {
    return { date: dateInput, windowLabel: windowLabel(), modeLabel: modeLabel(profileInput) };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setFeedback(null);

    const request = buildRequest();
    if (typeof request === "string") {
      setFeedback({ tone: "error", text: request });
      return;
    }

    setIsSubmitting(true);
    try {
      // Full typed wire response (RouteRiskApiResponse).
      const response: RouteRiskApiResponse = await api.post<RouteRiskData>(
        "/api/route-risk",
        request
      );
      const data = response.data;
      if (data !== null) {
        onPublishResult(data, resultContext());
        setFeedback({
          tone: "success",
          text: `${response.message}  routes drawn on the map.`
        });
      } else {
        setFeedback({ tone: "error", text: response.message || "Empty analysis result." });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        // Validation (400) and upstream/server errors alike carry the backend
        // envelope message; never surface raw stack traces (AGENTS.md §25).
        console.warn(`[route-risk] request failed (${error.status})`, error.message);
        setFeedback({ tone: "error", text: error.message });
      } else {
        console.error("[route-risk] unexpected failure", error);
        setFeedback({ tone: "error", text: "Something went wrong. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function windowLabel(): string {
    if (startTimeInput === "" && endTimeInput === "") return "Whole day so far";
    if (startTimeInput === "") return `Until ${endTimeInput}`;
    if (endTimeInput === "") return `From ${startTimeInput}`;
    return `${startTimeInput}–${endTimeInput}`;
  }

  const panelClass =
    "relative overflow-hidden rounded-panel border-[1.5px] border-border-subtle bg-glass-soft p-5 shadow-card backdrop-blur-lg";

  if (!expanded) {
    return (
      <section className={panelClass} aria-label="Trip summary">
        {panelTopBar}
        <div className="flex items-center gap-2.5">
          <img src={logoUrl} alt="" className="h-8 w-8" />
          <span className="bg-brand-gradient bg-clip-text text-base font-extrabold tracking-tight text-transparent">
            Aither
          </span>
        </div>
        <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-tertiary">
          Trip ready
        </p>
        <h1 className="mt-0.5 text-base font-extrabold leading-tight text-primary">
          Routes compared  see the map
        </h1>
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-brand" />
            <span className="font-semibold tabular-nums text-primary">
              {origin ? formatCoordinates(origin) : "—"}
            </span>
            <span className="text-xs text-tertiary">origin</span>
          </p>
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-brand-secondary" />
            <span className="font-semibold tabular-nums text-primary">
              {destination ? formatCoordinates(destination) : "—"}
            </span>
            <span className="text-xs text-tertiary">destination</span>
          </p>
          <p className="pl-4 text-xs text-secondary">
            {modeLabel(profileInput)} · {dateInput} · {windowLabel()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          disabled={isSubmitting}
          className="mt-4 w-full rounded-control border-[1.5px] border-brand/40 bg-surface px-3 py-2.5 text-xs font-bold text-brand transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Edit trip &amp; compare again
        </button>
      </section>
    );
  }

  const originArmed = pickingTarget === "origin";
  const destinationArmed = pickingTarget === "destination";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <section className={panelClass} aria-label="Plan a cooler trip">
        {panelTopBar}
        <div className="flex items-center gap-2.5">
          <img src={logoUrl} alt="" className="h-9 w-9" />
          <span className="bg-brand-gradient bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            Aither
          </span>
        </div>
        <h1 className="mt-3 text-lg font-extrabold leading-tight text-primary">Plan a cooler trip</h1>
        <p className="mt-1 text-xs leading-relaxed text-secondary">
          Compare walking, driving, and cycling routes by estimated heat exposure. Every number
          comes from measured temperature data recorded for the date you pick  never a forecast.
        </p>

        <div className="mt-4 rounded-control border border-border-subtle bg-surface p-3">
          <StepStrip
            originSet={origin !== null}
            destinationSet={destination !== null}
            hasResult={hasResult}
            busy={isSubmitting}
          />
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <FieldLabel icon={originIcon}>Origin</FieldLabel>
              <button
                type="button"
                onClick={onUseCurrentLocation}
                disabled={isSubmitting || locationStatus === "locating"}
                aria-busy={locationStatus === "locating"}
                className="mb-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold text-brand transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locationStatus === "locating" ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-brand/40 border-t-brand"
                    />
                    Locating…
                  </>
                ) : (
                  "Use my location"
                )}
              </button>
            </div>
            <PointPickerButton
              target="origin"
              number="1"
              point={origin}
              armed={originArmed}
              disabled={isSubmitting}
              idleDiscClass="bg-brand/15 text-brand"
              armedButtonClass="border-brand bg-brand/10 font-semibold text-brand"
              onTogglePick={onTogglePick}
            />
            {locationStatus === "denied" && (
              <p role="alert" className="mt-1.5 px-1 text-xs font-semibold leading-relaxed text-risk-high-text">
                Location permission was denied  allow it in your browser settings, or pick the
                origin on the map.
              </p>
            )}
            {locationStatus === "unavailable" && (
              <p role="alert" className="mt-1.5 px-1 text-xs font-semibold leading-relaxed text-risk-high-text">
                Couldn&apos;t get your location  try again, or pick the origin on the map.
              </p>
            )}
          </div>

          <div>
            <FieldLabel icon={destinationIcon}>Destination</FieldLabel>
            <PointPickerButton
              target="destination"
              number="2"
              point={destination}
              armed={destinationArmed}
              disabled={isSubmitting}
              idleDiscClass="bg-brand-secondary/15 text-brand-secondary"
              armedButtonClass="border-brand-secondary bg-brand-secondary/10 font-semibold text-brand-secondary"
              onTogglePick={onTogglePick}
            />
          </div>

          {pickingTarget !== null && (
            <p role="status" className="px-1 text-xs leading-relaxed text-secondary">
              Tap the map to drop the {pickingTarget} point. Click the highlighted button again to
              cancel.
            </p>
          )}

          <div aria-hidden="true" className="h-px bg-border-subtle" />

          <div>
            <FieldLabel icon={routeIcon} id="transport-mode-label">
              Transport mode
            </FieldLabel>
            <div
              role="radiogroup"
              aria-labelledby="transport-mode-label"
              className="grid grid-cols-3 gap-1 rounded-control border-[1.5px] border-border-subtle bg-surface p-1"
            >
              {PROFILE_OPTIONS.map((option) => {
                const selected = profileInput === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isSubmitting}
                    onClick={() => setProfileInput(option.value)}
                    className={`rounded-[9px] px-2 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? "bg-brand-gradient text-white shadow-button-primary"
                        : "text-secondary hover:bg-map-base hover:text-primary"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div aria-hidden="true" className="h-px bg-border-subtle" />

          {/* "When" group: recessed well so the three inputs read as one cluster
              (glass panel → map-base well → surface inputs = layered depth). */}
          <div className="rounded-control bg-map-base/70 p-3">
            <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel htmlFor="trip-date" icon={calendarIcon}>
                Date
              </FieldLabel>
              <input
                id="trip-date"
                type="date"
                min={DATE_FLOOR}
                max={todayDate}
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                disabled={isSubmitting}
                className={`${neutralInputClass} ${neutralFocusClass}`}
              />
            </div>
            <div>
              <FieldLabel htmlFor="trip-start-time" icon={clockIcon}>
                From
              </FieldLabel>
              <input
                id="trip-start-time"
                type="time"
                value={startTimeInput}
                max={isToday ? nowTime : undefined}
                onChange={(event) => setStartTimeInput(event.target.value)}
                disabled={isSubmitting}
                className={`${neutralInputClass} ${neutralFocusClass}`}
              />
            </div>
            <div>
              <FieldLabel htmlFor="trip-end-time" icon={clockIcon}>
                To
              </FieldLabel>
              <input
                id="trip-end-time"
                type="time"
                value={endTimeInput}
                max={isToday ? nowTime : undefined}
                min={startTimeInput !== "" ? startTimeInput : undefined}
                onChange={(event) => setEndTimeInput(event.target.value)}
                disabled={isSubmitting}
                className={`${neutralInputClass} ${neutralFocusClass}`}
              />
            </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-control bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-button-primary transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-none disabled:bg-border-subtle disabled:text-tertiary disabled:shadow-none"
        >
          {isSubmitting ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              Analyzing…
            </>
          ) : (
            "Compare heat exposure"
          )}
        </button>

        {isSubmitting && (
          <p className="mt-2 text-center text-xs text-secondary" role="status">
            Live heat analysis usually takes 30–60 seconds…
          </p>
        )}

        {feedback && (
          <p
            role={feedback.tone === "error" ? "alert" : "status"}
            className={
              feedback.tone === "success"
                ? "mt-3 rounded-control bg-success-highlight px-3 py-2 text-xs font-semibold leading-relaxed text-risk-low-text"
                : "mt-3 px-3 py-2 text-xs font-semibold leading-relaxed text-risk-high-text"
            }
          >
            {feedback.text}
          </p>
        )}
      </section>
    </form>
  );
}
