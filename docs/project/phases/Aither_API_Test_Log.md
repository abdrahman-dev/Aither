# Aither — API Test Log: Phase 2 Live Verification Round

> **Status:** Complete
> **Date:** 2026-08-22

---

## 1. Overview

Phase 2 (FortyGuard + ORS integration) was closed in commit `c2a0114` on the
strength of static review, validation hardening, typecheck/build checks, and a
single live `/api/heatmap` test. That left a known gap: most of the endpoint
surface had never been exercised against the real providers. This testing
round closed that gap by manually driving every endpoint end-to-end against
the running dev server with live calls to the real FortyGuard and ORS APIs —
moving Phase 2's verification basis from "code review passed" to "empirically
works".

The round surfaced exactly one real bug (out-of-coverage detection, §4.6),
which required two fix iterations to get right. It is documented here honestly
as part of the record — the round-by-round trace is a useful account of the
debugging process, not something to sanitize away.

---

## 2. Method and Environment

- Manual requests via the Bruno HTTP client against the locally running
  `dev:api` server (no mocks, no fixtures — real provider credentials, real
  upstream calls).
- Coverage: happy paths for all three business endpoints plus `/api/health`,
  negative/validation cases for `/api/heatmap`, an out-of-coverage case
  (non-U.S. AOI), and the full `/api/route-risk` pipeline.
- This document is a record of results already obtained in the session;
  per AGENTS.md §6.1 no additional live calls were made while writing it.

---

## 3. Results at a Glance

| #  | Endpoint          | Scenario                          | Result            |
|----|-------------------|-----------------------------------|-------------------|
| 1  | `GET /api/health` | liveness                          | Pass              |
| 2  | `POST /api/route` | happy path                        | Pass              |
| 3  | `POST /api/heatmap` | happy path (tcm, filterType 1)  | Pass              |
| 4  | `POST /api/heatmap` | validation: future date         | Pass              |
| 5  | `POST /api/heatmap` | validation: unclosed ring       | Pass              |
| 6  | `POST /api/heatmap` | non-U.S. AOI (out-of-coverage)  | Pass (after fix)  |
| 7  | `POST /api/route-risk` | full integration happy path | Pass              |

All 7 scenarios pass as of this session.

---

## 4. Test Scenarios

### 4.1 `GET /api/health`

Returned `{error:false, message:"ok", data:{status:"ok"}}` immediately.
Server up, envelope shape correct.

**Pass**

### 4.2 `POST /api/route` — happy path

Origin/destination in the San Jose area (`foot-walking`). Returned
`error:false` with a real LineString geometry and a realistic `summary`
(`distanceMeters` ≈ 7876, `durationSeconds` ≈ 5670). ORS integration
confirmed against live data.

**Pass**

### 4.3 `POST /api/heatmap` — happy path

Same AOI as earlier live tests, `tcm` / `filterType: 1`. Returned a
correctly-shaped heatmap: 395 tiles with realistic temperatures
(~26.8–28 °C) and proper statistics. Submit + poll completed in ~10 s.
Confirms the Phase 2 live result remains reproducible.

**Pass**

### 4.4 `POST /api/heatmap` — validation: future date

`date: "2027-01-01"` → correctly rejected with `error:true`:
"date must be YYYY-MM-DD between 2021-01-01 and today (forecast dates are
not supported)." Forecast dates are refused client-side of FortyGuard, per
contract.

**Pass**

### 4.5 `POST /api/heatmap` — validation: unclosed polygon ring

Polygon whose first/last coordinates did not match → rejected immediately
(before any FortyGuard call) with `error:true`: "polygonAoi must be a GeoJSON
FeatureCollection whose features are Polygon(s) ([longitude, latitude])."
The Phase 2 ring-closure hardening works and costs no credits when it trips.

**Pass**

### 4.6 `POST /api/heatmap` — non-U.S. location (Cairo coordinates)

This scenario found the round's one real bug and took **three rounds** to get
right:

- **Round 1 (failed):** Cairo AOI returned `error:false` with empty
  `map.features: []` and no statistics at all — a silent "success" carrying
  no data. This violates the D3 requirement (Phase_0_5 §4): out-of-coverage
  must surface a lightweight, non-technical error message, never a fake-ok
  response. Root cause: no detection logic existed yet.
- **Round 2 (partial fix, still failed):** Added a `NoCoverageError` check
  based on `map_data.features` presence and a `stats_data` key-count. The
  identical Cairo request *still* returned `error:false` — now with
  `statistics:{kind:"tcm"}` present but carrying no numeric fields. Root
  cause: the check tested whether `stats_data` had ANY keys, not whether it
  had actual numeric data — a marker-only stats object (`{kind:"tcm"}`) has
  keys, so the guard incorrectly treated it as real data and let the request
  fall through to normalization. (Side effect worth recording: the payload
  resolved normally in ~1 minute, proving the earlier suspected "hang" was
  just the normal silent poll window — see §5.)
- **Round 3 (fixed and confirmed):** Detection rewritten to derive
  `hasNumericStats` from the same `normalizeStatistics()` function used to
  build client-facing statistics — requiring an actual numeric value
  (`minimum`/`maximum`/`mean`/`standardDeviation` for `tcm`;
  `nCells`/`minimum`/`maximum`/`mean` for the analysis types) rather than
  raw key presence. Retested the identical Cairo payload: resolved in ~40 s
  with `error:true`, message "No heat data available for this location.
  Coverage is currently limited to the United States."

**Pass (after fix)** — out-of-coverage is now a normal, clearly-communicated
user-facing state per D3.

### 4.7 `POST /api/route-risk` — full integration happy path

Origin/destination in the San Jose area, date 2024-07-15, window 12:00–18:00.
Logs confirmed **exactly 3 heatmap submissions** (`tcm`, `exceedance`,
`persistence`) — no duplicates, confirming the in-flight dedupe fix holds
under the full pipeline. All three activities reached `status=completed`.
Response contained:

- per-route `heat` data (`peakTemperatureC`, `exceedanceHours`,
  `persistenceHours`),
- `risk` score 0.35, level "moderate", with the D1 terms breakdown,
- a shared `hull` (single AOI covering both routes, within the Basic plan
  area cap — D2),
- a `recommendation` (lowest-risk route) and a `tradeoff`
  (`extraMinutes: 1`, `extraDistanceMeters: 100`,
  `heatExposureReductionPercent: 46`),

matching the demo scenario described in Aither_Project_Documentation.md.

**Pass**

---

## 5. Side Lesson: Poll-Window Visibility

During the §4.6 investigation, a ~5-minute wait was mistaken for a hang or
regression. It was not: polling was simply silent while working normally, and
the later rounds' ~1-minute and ~40-second resolution times confirmed there
was never an actual hang — only missing operator visibility during long-but-
normal polls. A periodic progress log was added during this investigation so
in-flight activity polls are visible in the server output going forward,
preventing the same confusion.

---

## 6. Summary

- **All 7 test scenarios pass** as of this session.
- One real bug was found and fixed during the round: out-of-coverage
  detection (`NoCoverageError`). It took **two fix iterations** to get right
  — first no detection at all, then a key-count check that marker-only stats
  objects defeated, and finally a numeric-content check derived from the same
  normalization used for client responses. Both failed intermediate states
  are documented above deliberately: they show why the final form of the
  guard is shaped the way it is.
- Phase 2's implementation is now **empirically verified end-to-end via live
  calls against the real FortyGuard and ORS APIs** — not just via static
  review and build checks. This closes the gap between "code review passed"
  and "actually works", which is the reason this testing round happened.

---

## 7. Status

**The backend is now considered fully verified and ready for Phase 3
(frontend integration) to begin.**

---

## 8. Test Log Checklist

- [x] `GET /api/health` returns ok envelope
- [x] `POST /api/route` returns real ORS LineString + realistic summary
- [x] `POST /api/heatmap` happy path: correct 395-tile tcm result, realistic temperatures/statistics
- [x] Future-date validation rejects with clear contract message
- [x] Malformed polygon (unclosed ring) rejected before any FortyGuard call
- [x] Non-U.S. AOI surfaces lightweight D3 out-of-coverage error (`NoCoverageError`)
- [x] Out-of-coverage detection bug fixed (numeric-content check via `normalizeStatistics()`), retested and confirmed
- [x] `POST /api/route-risk` end-to-end: exactly 3 heatmap activities (dedupe holds), completed, D1/D2/recommendation/tradeoff all present and realistic
- [x] Periodic poll progress logging added (operator visibility during normal polls)
- [x] All findings committed to the record; backend verified, Phase 3 unblocked
