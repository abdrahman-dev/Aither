# Aither — Development Phase 2: FortyGuard + ORS Integration

> **Status:** Complete
> **Date:** 2026-08-21

---

## 1. Overview

Phase 2 implemented the real backend API surface on top of the Phase 1
foundation and the Phase 0.5 contract corrections / D1–D4 product decisions:

- `POST /api/heatmap` — FortyGuard `tcm` + analysis heatmaps
  (`time_of_measure` / `exceedance` / `persistence`) over a supplied AOI,
  normalized by `analytic_type` (AGENTS.md §9.3).
- `POST /api/route` — OpenRouteService directions (one or more alternative
  routes per request, `/geojson` variant).
- `POST /api/route-risk` — end-to-end route heat comparison: ORS routes →
  one shared hull AOI (D2) → `tcm` + `exceedance` + `persistence` heatmaps over
  that single AOI → per-route sampling → D1 risk scores normalized across
  routes → recommendation + tradeoff.

All FortyGuard HTTP calls live behind `services/fortyguard/client.ts`
(centralized submit + case-insensitive status polling, 3 s / 600 s defaults,
transient 404 + network retry with backoff — AGENTS.md §12). The API key stays
backend-only (never exposed to the frontend). Response/error handling uses the
`{ error, message, data }` envelope on every path.

---

## 2. Files Added

```text
apps/api/src/services/fortyguard/{client,heatmap,envParams,types,errors,index}.ts
apps/api/src/services/routing/{client,types,errors,index}.ts
apps/api/src/services/heat/{hull,sampling,routeAnalysis}.ts
apps/api/src/services/risk/index.ts            (D1 weights/relative normalization/classification)
apps/api/src/utils/{validate,http,cache,requestCache,inflight}.ts
```

Key behaviors:

- **Dedupe:** identical concurrent requests share one in-flight promise
  (`utils/inflight.ts`) so duplicates cannot each resubmit expensive FortyGuard
  activities; identical repeated requests short-circuit via a deterministic
  TTL cache keyed on canonical request fields (`utils/requestCache.ts`).
- **Resilient polling:** status 404 right after submission and transient
  network failures are retried with exponential backoff up to the hard
  600 s deadline.
- **Null handling:** unavailable FortyGuard values stay `null`/unavailable,
  never coerced to 0 (AGENTS.md §13).

---

## 3. Live Verification

`POST /api/heatmap` was exercised against the live FortyGuard API and returned
correct, real heatmap data for a real AOI — after the dup-submission fix
(in-flight dedupe) and the resilient-polling fix (404/network retry with
backoff) were applied. `/api/route` and `/api/route-risk` were not re-tested
live in this checkpoint pass (static review + build verification only, per
AGENTS.md §6.1).

---

## 4. Final Review Pass (this checkpoint)

A full static review of all three endpoints plus the services and utils was
performed (no live calls — AGENTS.md §6.1). Findings and resolutions:

### Fixed in this pass

- **Debug logging removed** (`services/fortyguard/client.ts`): the per-poll
  tick (`Activity <id> poll status=...`) and the per-transient-retry logs are
  gone. One structured line remains per activity: the existing submission line
  in `heatmap.ts`/`envParams.ts`, plus a single `Activity <id> completed` line
  on terminal success in `client.ts`. Terminal failures already surface through
  `handleServiceError`.
- **Polygon validation hardened** (`utils/validate.ts`): ring coordinates now
  range-checked (lat −90..90, lon −180..180), rings must be closed (GeoJSON
  spec), and every feature in the AOI must be a valid Polygon (was: any one).
- **Window validation added** (`routes/heatmap.ts`,
  `services/heat/routeAnalysis.ts`): `filterType 2` requires `endTime` after
  `startTime`; `filterType 4` requires `endDate` on/after `startDate`;
  `/api/route-risk` rejects `endTime` before `startTime`.
- **Malformed-response guards** (`services/fortyguard/client.ts`): `submit`
  and `getStatus` now reject non-object envelopes (e.g. a JSON `null` body or
  missing `data`) with `FortyGuardError` instead of a 500 `TypeError`; the
  status string is string-coerced before case-insensitive matching.
- **Hull errors mapped** (`services/heat/hull.ts`): hull construction failures
  now throw `RoutingError` (→ 502) instead of a generic `Error` (→ 500).
- **Phase-1 stubs removed:** unused `routes/risk.ts` router deleted; vestigial
  `RouteRiskResult` stub dropped from `packages/shared/src/route-risk.ts`
  (nothing consumed it; the canonical Phase 2 result shape lives in
  `services/heat/routeAnalysis.ts`). Web re-export updated accordingly.
- **Stale comment updated** (`utils/cache.ts`): no longer references an
  unimplemented "Phase 2+" wiring.

### Reviewed and confirmed clean

- **Partial-failure in `/api/route-risk`:** if ORS fails, `RoutingError` → 502;
  if any of the three heatmap activities fails, the shared `Promise.all`
  rejects → lightweight 502. The request fails whole (no fabricated or degraded
  scores) because D1 needs all three terms and the response contract is a fixed
  `["tcm","exceedance","persistence"]` tuple. Concurrency note: if one of the
  three activities fails fast, the other two keep polling server-side and may
  still reach `Completed` (billed); they cannot be cheaply cancelled.
- **Input validation coverage** per endpoint before any external call:
  coordinate bounds, date range (2021-01-01..today), filterType-specific
  required fields, granularity (60/80/100), analyticType, threshold+direction
  for exceedance/persistence, origin≠destination, window ordering.
- **Envelope consistency:** every success and error path in all three routes
  emits `{ error, message, data }` (`data: null` on error).

### Flagged (not changed — product/contract decisions)

- **`profile` is not whitelisted** on `/api/route` and `/api/route-risk`; an
  unknown profile string goes to ORS and surfaces as a 502 `RoutingError`.
  Whitelisting supported ORS profiles would move this to a 400 but the
  supported set is a product decision.
- **D4 past-hours-only** is enforced at the departure-time picker (AGENTS.md
  §17 "blocked at the picker"); the backend enforces `date ≤ today` but an hour
  later than "now" on today's date is not rejected. Consistent with the
  documented picker-first decision; timezone-safe backend enforcement would be
  a follow-up decision.
- **Route-risk degraded-mode** (e.g. produce a peak-temperature-only result if
  exceedance/persistence fail) was considered and rejected for this pass — it
  changes the response contract and the D1 guarantees; open for a future pass
  if partial results are desired.
- **Shared result types:** the Phase 2 comparison result type lives in
  `services/heat/routeAnalysis.ts`; promoting it (or a shaped subset) into
  `@aither/shared` for the future web integration is left to the next phase.

---

## 5. Verification

`npm run typecheck` and `npm run build` pass clean for all three workspaces
(`@aither/shared`, `@aither/api`, `@aither/web`). No dev servers were started
and no live API calls were made during this pass.

---

## 6. Status

**Phase 2 is fully closed.** The three endpoints are implemented against the
real providers, the dedupe + resilient-polling fixes are confirmed against live
data, the final review pass is complete, and all changes are committed locally
(this checkpoint is included in that commit). Pushing is deferred until the
user reviews the commit.

---

## 7. Phase 2 Checklist

- [x] `POST /api/heatmap` implemented + normalized per `analytic_type`
- [x] `POST /api/route` implemented against ORS directions
- [x] `POST /api/route-risk` implemented (D1 + D2 wired end-to-end)
- [x] Centralized activity polling with case-insensitive terminal matching
- [x] Transient 404 + network retry with backoff and a hard deadline
- [x] In-flight dedupe + TTL request cache preventing duplicate-cost calls
- [x] `{ error, message, data }` envelope on every success/error path
- [x] Null handling preserved (never 0)
- [x] No fake/fallback production data (live calls only)
- [x] API key backend-only, never logged
- [x] Live test confirmed `/api/heatmap` returns correct real data
- [x] Debug per-poll logging removed; minimal terminal logging retained
- [x] Static review + validation hardening complete (this pass)
- [x] `npm run typecheck` and `npm run build` pass for all three workspaces
- [x] Phase 2 completion checkpoint documented and committed locally