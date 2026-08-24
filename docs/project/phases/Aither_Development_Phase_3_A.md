# Aither — Development Phase 3.A: Heat-Aware Trip Planning UI

> **Status:** Complete
> **Date:** 2026-08-24

---

## 1. Overview

Phase 3.A built the route-comparison frontend on top of the completed
Phase 2 backend (`POST /api/route-risk`) and the existing MapLibre base map.
For the first time, a user can plan a trip end-to-end in the browser:

- pick origin/destination by clicking the map (or adopt their GPS fix),
- choose a transport mode (Walking / Driving / Cycling → ORS profile),
- pick a measured-data date/time window (D4-capped, past hours only),
- compare returned routes as color-coded lines with numbered chips,
- read per-route heat stats and the recommendation in a results card.

Every number shown comes from FortyGuard's **measured** catalog for the
selected date — the UI states "not a forecast" explicitly (D4).

---

## 2. Files Added / Changed

```text
apps/web/src/features/routing/useTripPlanning.ts   (new — shared planning state hook)
apps/web/src/features/routing/RoutePlanner.tsx     (new — form, mode selector, picker buttons)
apps/web/src/features/routing/ResultsCard.tsx      (new — route cards, recommendation, context)
apps/web/src/map/BaseMap.tsx                       (changed — markers, route layers, draw order)
apps/web/src/App.tsx                               (changed — wiring)
apps/web/src/index.css                             (changed — .aither-marker-drop keyframes)
apps/web/src/api/client.ts                         (changed — typed envelope handling)
apps/web/vite.config.ts                            (changed — maplibre worker/optimizeDeps)
packages/shared/src/{route-risk,route}.ts          (promoted wire types — see Phase 2 follow-up commit)
```

---

## 3. What Was Built

### 3.1 Route drawing & color fix

- `LEVEL_LINE_COLORS`: low → Emerald 600 `#059669`, moderate → Orange 500
  `#F97316` (`risk-moderate-toggle` token; Orange 700 read nearly identical to
  Red 600 at line width), high/critical → Red 600 `#DC2626`, unknown → gray.
- White casing under all lines keeps risk colors readable over the OSM raster;
  the recommended route gets a wider casing plus a soft brand glow layer.
- `LEVEL_DRAW_ORDER` sorts features hottest-first so cooler routes paint on top
  of shared corridors; the recommended route always ends up topmost (+10 rank).

### 3.2 Trip planner

- Numbered point-picker buttons ("Pick origin/destination on map") arm
  crosshair mode; clicking the active button again cancels. Map clicks only
  mutate trip state while a picker is armed.
- Transport mode selector: segmented radiogroup (`foot-walking`,
  `driving-car`, `cycling-regular`) wired to the request body's `profile`.
- Date defaults to 3 days back (`DEFAULT_DATE_DAYS_BACK`) because same-day TCM
  has processing latency while past dates return full results (confirmed live);
  today stays selectable in the picker.
- D4 enforcement at the form level: date ≤ today, and when date = today both
  time inputs are capped at "now" with plain-language errors.
- Step strip (Origin → Destination → Date & time → Compare) mirrors progress;
  publishing a result collapses the planner into a compact summary.

### 3.3 Measured-data messaging

- Planner intro copy states every number comes from measured temperature data,
  never a forecast.
- The results card shows a context line fed by `ResultContext`
  (`{date, windowLabel, modeLabel}`): e.g. *"Measured conditions for
  2026-08-21 · 14:00–15:00 · walking — not a forecast."*

### 3.4 Geolocation (one-shot)

- `fetchCurrentLocation()` uses `getCurrentPosition` only — never
  `watchPosition`/tracking. Success adopts the fix as the trip origin, cancels
  any active picking, and drops a blue "you are here" dot (`#2563EB`,
  deliberately outside the palette so it never reads as trip data) with an
  accuracy halo and an optional heading wedge.
- Failure statuses (`denied`, `unavailable`) surface inline under the Origin
  field with recovery guidance; no browser alerts.
- Once the fix is adopted as the origin, the raw dot hides so two blue markers
  never stack on one point.

### 3.5 Endpoint pins & route chips

- Origin/destination markers carry bold **A**/**B** letters (22 px circles,
  white ring) so endpoints read on the map alone.
- Each drawn route gets a numbered chip at its midpoint, indexed identically to
  the Results Card list ("Route N") — disambiguating same-risk-tier routes whose
  line colors repeat. The recommended chip swaps its risk color for the §2.3
  brand gradient. This replaces an earlier floating "Recommended" pill.

---

## 4. Follow-Up Bug Fixes (root causes worth remembering)

Two rounds of live-testing bugs shared one family of root cause:

1. **Geolocation dot landed far from its coordinates.** An inline
   `position: relative` on the marker element overrode MapLibre's stylesheet
   rule `.maplibregl-marker { position: absolute }`; left in flow at the
   container's top-left corner, the positioning transform then displaced it.
   Fix: explicit `position: absolute` + explanatory comment.
2. **A route chip froze at the container's top-left corner.**
   `.aither-marker-drop` keyframes animated `transform` with
   `animation-fill-mode: both`, so the frozen end-frame permanently overrode
   MapLibre's inline positioning transform — silently breaking **every**
   marker carrier (the A/B pins hid under the floating planner panel).
   Fix: animate the individual `translate:`/`scale:` properties instead, which
   compose with `transform` instead of replacing it; the CSS carries a warning
   comment against ever animating `transform` there again.

> Rule of thumb: MapLibre positions marker elements purely via inline
> `transform` on top of `.maplibregl-marker { position: absolute }`. Never
> override `position` or animate/fill-freeze `transform` on a marker element.

---

## 5. Final Review Pass (this checkpoint)

Full static re-review of all Phase 3.A files plus docs (no live calls —
AGENTS.md §6.1). Findings and resolutions:

### Fixed in this pass

- **Duplicate type removed (AGENTS.md §21):** local `type PickTarget` in
  `RoutePlanner.tsx` deleted; both `RoutePlanner.tsx` and `BaseMap.tsx` now
  import the canonical export from `useTripPlanning.ts` (BaseMap previously
  spelled the union out inline).
- **Stale comment corrected** (`RoutePlanner.tsx`): the step strip note claimed
  the date input "defaults to today"; it defaults 3 days back.

### Reviewed and confirmed clean

- All six marker carriers position consistently (pins ×2, chips, location dot;
  halo pings on a child span, which is safe).
- Tailwind classes used across the new components all resolve to tokens defined
  in `tailwind.config.js` (verified against `UIUX_Design_Guidelines.md` §2–§3).
- D4 caps, origin ≠ destination guard, envelope/error handling, unmount
  cleanup, and latest-callback ref patterns all correct.
- No dead code: the old "Recommended" pill path is fully removed.

### Flagged (not changed — product decisions for a later pass)

- The full `/api/route-risk` payload is still logged to the browser console on
  success (and the success copy mentions it). Intentional during live testing;
  decide whether to keep or quiet it in the polish phase.
- The app bundle exceeds Vite's 500 kB chunk warning (maplibre-gl dominates).
  Code-splitting is a Phase 3.B/polish candidate.

---

## 6. Verification

- `npm run typecheck` and `npm run build` pass clean for all three workspaces
  (`@aither/shared`, `@aither/api`, `@aither/web`) after every change round.
- Live end-to-end testing (user-driven, real API): Alexandria geolocation fix
  landed correctly in Egypt; routes differentiated by color; mode switching
  produced visibly different geometries; A/B pins and numbered chips rendered
  at correct coordinates after the CSS root-cause fix.

---

## 7. Status

**Phase 3.A is fully closed.** The heat-aware trip-planning UI is complete,
reviewed, documented, and committed. Next up: **Phase 3.B** — map-style
simplification and layout rebalancing (per UIUX_Design_Guidelines.md).

---

## 8. Phase 3.A Checklist

- [x] Route lines drawn from `RouteRiskData` with risk-tier colors + casings/glow
- [x] Draw-order fix: cooler/recommended routes paint above shared corridors
- [x] Map-click point picking with armed/cancel states + crosshair cursor
- [x] A/B lettered endpoint pins
- [x] Transport mode selector (walking/driving/cycling) wired to `profile`
- [x] Measured-data messaging (planner intro + results context line, D4)
- [x] One-shot geolocation adoption + blue dot + denial/unavailable states
- [x] Numbered midpoint chips tied to Results Card entries (recommended = gradient)
- [x] Marker positioning root causes fixed (position override; transform animation)
- [x] Duplicate `PickTarget` type consolidated into `useTripPlanning`
- [x] Docs updated where superseded (Project Documentation §24/§32, Technical Plan §1.1)
- [x] `npm run typecheck` and `npm run build` pass for all three workspaces
