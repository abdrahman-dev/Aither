# Aither — Development Phase 0.2: Documentation Finalization

> **Status:** Complete
> **Date:** 2026-08-19

---

## 1. Context

After Phase 0 established the monorepo skeleton, the team received the official
FortyGuard reference implementation (`docs/reference/temperature-api-quickstart`)
and ran a full compatibility audit against it. This checkpoint records the
resulting contract corrections and product decisions as the **final pre-implementation
state** — Phase 1 (implementation) begins after this document.

---

## 2. Reference Source of Truth

`docs/reference/temperature-api-quickstart` (official Python client, notebooks,
and cached responses) is the **canonical FortyGuard contract reference**. Per
AGENTS.md, it takes precedence over any project doc wherever they conflict;
project docs are corrected to match it, never the reverse. It is kept out of
version control (own git history) — see the commit record.

---

## 3. Contract Corrections Applied

Concise summary — full detail lives in `Aither_FortyGuard_API_Reference.md`.

- **Response envelope:** body is `{ error, message, data }` — no `status_code`
  field in the JSON body (HTTP status carries it).
- **Terminal status matching:** case-insensitive; `completed`/`succeeded` are
  terminal success, `failed`/`error` terminal failure, everything else keeps
  polling. Reference poll defaults: interval 3 s, timeout 600 s.
- **`env_params` response shape:** real shape confirmed — `solar_irradiance`
  carries `clear_sky.{ghi, dni, dhi}` + `description`, `temperature` echoes the
  request anchor, `elevation` present; nulls occur **per-sample** inside array
  parameters and must be treated as unavailable, never as 0.
- **`analysis` parameter set:** the unverified "3-parameter cap" was replaced by
  the real **17 validated names** from `fortyguard/client.py`. No count cap is
  enforced.
- **`tcm` tile shape:** tiles **never** include per-hour `'00'..'23'` fields —
  a single `temperature` per tile for `filter_type` 1/2, or
  `average_temperature`/`min_temperature`/`max_temperature` for 3/4.
- **Granularity cost trade-off:** same AOI at 100 m vs 60 m ≈ 10k vs 28k tiles
  (~104 km²), i.e. longer runtime and higher credit cost; choose the coarsest
  granularity that answers the question.
- **`filter_type=3` default:** recommended for heatmap requests — one call yields
  both the daily peak and the full diurnal series for the risk engine.
- **Forecast language removed:** the API supports `2021-01-01` to today only; all
  "forecast"/"12-hour" claims were stripped from product docs.

---

## 4. Product Decisions Finalized

### D1 — Risk scoring formula

```text
segmentRiskScore =
    (0.3 × normalized peak temperature)
  + (0.4 × normalized exceedance)
  + (0.3 × normalized persistence)
```

All three inputs are normalized **0–1 relative to the routes being compared**
(not on an absolute scale).

**Implementation implication:** this requires **two separate FortyGuard requests
per AOI** — one `tcm` / `filter_type=3` request for peak/avg/min temperature, and
one `exceedance` (or `persistence`) / `filter_type=2` request scoped to the
trip's hour range. Exceedance/persistence require a range `filter_type`, while
`tcm`'s richest single-day data uses `filter_type=3`.

### D2 — AOI sizing for route comparison

One **shared hull AOI** covering all compared routes per request — not
per-route requests, and no hard area-based refusal when routes are far apart.
Hull sized within the active plan cap (Basic 10 mi², Premium 50 mi²).

### D3 — Location input stays open

No U.S.-only restriction in the UI. FortyGuard requests that fail because the
location is outside coverage surface a **lightweight, non-technical error
message** — never a raw API error. Out-of-coverage is a normal user-facing
state, not a crash.

### D4 — No forecasting

No forecasting anywhere in the product. The departure-time picker is restricted
to **past hours of the current day only**. The demo runs **live FortyGuard API
calls** — no cached/replay response strategy.

---

## 5. Status

This is the **final documentation checkpoint** before implementation. Contract
corrections and D1–D4 decisions are locked in. **Phase 1 (implementation)
begins next.**

---

## 6. Phase 0.2 Checklist

- [x] Full compatibility audit against the official FortyGuard reference performed
- [x] Response envelope corrected (no body-level `status_code`)
- [x] Terminal status matching defined case-insensitively with poll defaults
- [x] `env_params` response shape documented (confirmed fields, echoed values, per-sample nulls)
- [x] Unverified 3-parameter cap replaced with the real 17-name `analysis` set
- [x] `tcm` tile shape documented (no per-hour fields; varies by `filter_type`)
- [x] Granularity-cost trade-off documented
- [x] `filter_type=3` default recommendation recorded
- [x] Forecast language removed from product docs
- [x] D1 risk scoring formula finalized (0.3 peak / 0.4 exceedance / 0.3 persistence, relative normalization, two-request implication)
- [x] D2 shared-hull AOI sizing finalized
- [x] D3 open location input + lightweight out-of-coverage errors finalized
- [x] D4 no-forecast + live-demo finalized
- [x] Reference repo kept out of version control (own git history; see commit note)