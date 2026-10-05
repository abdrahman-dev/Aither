# Aither

**Urban Heat Intelligence & Heat-Aware Routing**

> Know where the heat is. Find the cooler way through it.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-aither--web--flax.vercel.app-34D399.svg)](https://aither-web-flax.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-0EA5E9.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org)
[![React 18](https://img.shields.io/badge/React-18-38BDF8.svg)](https://react.dev)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg)](https://www.typescriptlang.org)
[![FortyGuard Global AI Hackathon](https://img.shields.io/badge/Built%20for-FortyGuard%20Global%20AI%20Hackathon-34D399.svg)](https://api.fortyguard.com)

> **▶ Live demo:** **[aither-web-flax.vercel.app](https://aither-web-flax.vercel.app/)**
> Frontend deployed on Vercel, backend on Railway. Runs against live
> FortyGuard and OpenRouteService APIs — no mocked data.

**Aither was built for the FortyGuard Global AI Hackathon**, using the
FortyGuard Temperature API as its sole source of hyperlocal heat data.

Conventional route planners optimize for distance and time. For pedestrians and
outdoor workers in hot cities, heat exposure is a third axis — and two routes of
nearly equal length can have very different thermal conditions. Aither fetches
competing routes, measures the heat along each one, and recommends the
lower-exposure option with the tradeoff stated explicitly.

Aither uses **measured data only**. There is no forecasting anywhere in the
product, and none is claimed: the analysis window is restricted to past dates
and past hours of the current day.

<!-- TODO(screenshots): add a screenshots section here — suggested: docs/images/
     01-landing.png, 02-planner.png, 03-route-comparison.png, 04-results-card.png
     Markdown image links, one per line, so the grid renders. -->

---

## Table of Contents

- [What Aither Does](#what-aither-does)
- [Core Features](#core-features)
- [How the Heat Risk Score Works](#how-the-heat-risk-score-works)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Verification](#verification)
- [Design Decisions & Scope](#design-decisions--scope)
- [Known Limitations](#known-limitations)
- [Credits & Attribution](#credits--attribution)

---

## What Aither Does

A user picks an origin and a destination on the map, chooses a transport mode,
and selects a past date/time window. Aither then:

1. Requests the **fastest route plus alternatives** from OpenRouteService.
2. Builds **one shared bounding area** covering every compared route.
3. Submits **three asynchronous FortyGuard heatmap activities** over that single
   area — `tcm`, `exceedance`, and `persistence` — so all routes sit on a
   **common temperature scale** and credit cost stays flat regardless of how
   many routes are compared.
4. **Resamples each route geometry** along its length and matches the samples to
   heatmap tiles, deriving peak temperature, hours above threshold, and longest
   sustained heat run per route.
5. Scores every route with a **deterministic weighted formula** and
   **recommends the lowest-risk option**, reporting the exact cost of that
   recommendation (extra minutes, extra meters, estimated exposure reduction)
   computed from the real response data.

Every number on screen is derived from a live API response. Nothing is
hard-coded for effect.

## Core Features

- **Landing page** introducing the product before the planner opens.
- **Route planning** with origin/destination set by clicking the map (lettered
  A/B pins) or adopted from a one-shot device GPS fix — never continuous
  tracking.
- **Transport modes** — walking, driving and cycling (OpenRouteService profiles).
- **Date/time analysis window** — pick a past date and hour range; today's hours
  are capped at "now", because the underlying catalog is measured, not forecast.
- **Route comparison** — all compared routes are analyzed against one shared
  heatmap area, so the comparison is internally consistent.
- **Heat risk analysis** — peak temperature, threshold exceedance, and
  persistence are all first-class inputs to the score, not just peak heat.
- **Risk visualization** — risk-tier colored route lines on a MapLibre map with
  numbered chips tied to the results list; the recommended route is highlighted
  and drawn on top.
- **Recommendation & tradeoff** — lowest-risk route recommended, with the cost
  stated from actual computed data.
- **Honest data handling** — routes that cannot be matched to enough heat samples
  render as "no heat data" rather than a fabricated score; out-of-coverage
  locations surface a plain-language message instead of a raw provider error.

## How the Heat Risk Score Works

The score is a fixed weighted sum over three normalized signals
(`apps/api/src/services/risk/index.ts`):

```text
routeRiskScore =
    (0.3 × normalizedPeakTemperature)
  + (0.4 × normalizedExceedanceHours)
  + (0.3 × normalizedPersistenceHours)
```

| Term | Source signal | Why it is in the model |
|---|---|---|
| Peak temperature | `tcm` heatmap, daily max per tile | Captures absolute heat severity at the hottest point on the route |
| Threshold exceedance | `exceedance` heatmap, hours above threshold | Captures *duration* of dangerous heat — the signal that actually separates sites at city scale, where daily peak alone is nearly flat |
| Persistence | `persistence` heatmap, longest sustained run | Captures whether the heat is a brief spike or an unbroken stretch |

**Normalization.** Each term is min-max normalized **relative to the routes being
compared**, not on an absolute scale, so a score describes "hottest of these
options" rather than a universal threshold. When every compared route has an
identical value for a term, that term resolves to `0.5` (neutral) so it neither
dominates nor vanishes. Inputs and outputs are clamped to `[0, 1]`.

**Classification.**

| Score | Risk level |
|---|---|
| `≥ 0.75` | Critical |
| `≥ 0.50` | High |
| `≥ 0.25` | Moderate |
| `< 0.25` | Low |

**Request defaults.** Threshold `30 °C`, direction `above`, granularity `100 m`.

> The numeric weights and classification thresholds above are **project
> parameters** chosen for this product, not values validated against a published
> heat-health standard. Aither provides decision support, not a guarantee of
> safety.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Mapping | MapLibre GL JS v6 over the keyless CARTO Voyager vector basemap |
| Backend | Node.js (≥18), Express 4, TypeScript, `tsx` for development |
| HTTP | Native `fetch` (no axios) |
| Routing provider | OpenRouteService Directions API |
| Heat data provider | FortyGuard Temperature API (`/v1/heatmap`, `/v1/env_params`, `/v1/status`) |
| Storage / database | None — in-memory TTL caches only |
| Monorepo | npm workspaces |
| Testing | None — verification is `typecheck` + `build` (see [Verification](#verification)) |

All external API keys live in **backend** environment variables only. The
frontend talks exclusively to Aither's own backend and never sees provider keys,
activity IDs, or polling state.

## Architecture

```text
User
  → Landing page → Route Planner (pick points, mode, date/time window)
    → POST /api/route-risk  (Aither backend)
      → OpenRouteService directions (fastest + alternatives)
      → one shared hull AOI covering all compared routes
      → three async FortyGuard heatmaps over that AOI:
          tcm (full day) + exceedance + persistence (trip window)
      → submit activity → poll /v1/status/{activity_id} until terminal
      → resample each route and match samples to heatmap tiles
      → D1 risk score per route → recommendation + tradeoff
    ← { error, message, data } envelope
  → Map (risk-colored routes) + Results card
```

Every FortyGuard analysis is **asynchronous**. The backend submits the activity,
polls `/v1/status/{activity_id}` (case-insensitive terminal statuses,
transient-network retry, bounded by a hard deadline), and normalizes the response
into shared contract types before anything reaches the frontend. The normalizer
branches on `analytic_type`, because the heatmap endpoint returns different
shapes per analysis type.

Two cost-control mechanisms sit in front of the expensive calls:

- **Single-flight dedupe** — concurrent identical requests share one in-flight
  promise, so duplicate clicks cannot submit duplicate paid activities.
- **Short-TTL response cache** — 5 minutes for single-source lookups, 10 minutes
  for route-risk (one comparison triggers three activities).

## Project Structure

```text
aither/
├── apps/
│   ├── api/                          # Express + TypeScript backend
│   │   └── src/
│   │       ├── config.ts             # env loading, fail-fast validation
│   │       ├── server.ts
│   │       ├── routes/               # /api/heatmap, /api/route, /api/route-risk
│   │       ├── services/
│   │       │   ├── fortyguard/       # client, polling, normalization, types
│   │       │   ├── routing/          # OpenRouteService client
│   │       │   ├── heat/             # shared hull, sampling, route-risk pipeline
│   │       │   └── risk/             # D1 scoring + classification
│   │       └── utils/                # validation, caching, dedupe, HTTP errors
│   └── web/                          # React + Vite frontend
│       ├── public/                   # favicon + social preview image
│       └── src/
│           ├── api/                  # typed client for Aither's own backend
│           ├── assets/               # brand logo
│           ├── features/
│           │   ├── landing/          # entry page
│           │   └── routing/          # planner, results card, planning hook
│           │       └── (heatmap/ · risk/ · components/ reserved for upcoming work)
│           ├── map/                  # MapLibre base map + route layers/markers
│           └── types/                # shared contract re-exports
├── packages/shared/                  # @aither/shared wire-contract types
├── docs/
│   ├── design/                       # UI/UX design guidelines (palette, components)
│   ├── project/                      # architecture, FortyGuard contract, phase records
│   └── reference/                    # vendored FortyGuard reference (untracked — see below)
├── AGENTS.md                         # engineering rules governing changes to this repo
├── railway.json                      # backend deployment (Railway)
└── apps/web/vercel.json              # frontend deployment (Vercel)
```

> **Note on `docs/reference/`.** The official FortyGuard Python reference client
> and notebooks are vendored there as a nested git repository with its own
> history and license, so it is intentionally **not** committed into this repo.
> `docs/project/Aither_FortyGuard_API_Reference.md` is the in-repo contract that
> Aither's code implements.

## Getting Started

**Prerequisites:** Node.js ≥ 18 and npm.

```bash
# 1. Install all workspace dependencies.
#    The postinstall hook builds @aither/shared, which the other two
#    workspaces consume — so this step must complete before running the app.
npm install

# 2. Create your environment file and fill in the two provider API keys.
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env

# 3. Start the backend and frontend in separate terminals.
npm run dev:api           # backend  → http://localhost:3000
npm run dev:web           # frontend → http://localhost:5173
```

The frontend defaults to `http://localhost:3000` for the backend, so the two work
together with no further configuration.

**Verify the backend is up:**

```bash
curl http://localhost:3000/api/health
```

### Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install all workspaces (also builds `@aither/shared`) |
| `npm run dev:api` | Run the backend in watch mode |
| `npm run dev:web` | Run the frontend dev server |
| `npm run build` | Build shared → api → web |
| `npm run typecheck` | Typecheck all three workspaces |

## Environment Variables

Copy `.env.example` to `.env` at the repository root and fill in real values.
Never commit real secrets — `.env` and all `.env.*` variants are gitignored.

| Variable | Side | Required | Purpose |
|---|---|---|---|
| `FORTYGUARD_API_KEY` | Backend only | Yes | FortyGuard API key |
| `FORTYGUARD_BASE_URL` | Backend only | Yes | Defaults to `https://api.fortyguard.com` |
| `ORS_API_KEY` | Backend only | Yes | OpenRouteService API key |
| `PORT` | Backend only | Yes | Backend port (default `3000`) |
| `VITE_API_BASE_URL` | Frontend build-time | No | Aither backend **base URL** (e.g. `http://localhost:3000`) |

The backend **fails fast on startup** if a required variable is missing, empty,
or malformed, and prints the exact list of what it needs.

`VITE_API_BASE_URL` is a base URL only — the frontend appends paths such as
`/api/route-risk` itself, so do not include an endpoint path in it.

## API Reference

The frontend never talks to FortyGuard or OpenRouteService directly; Aither's
backend owns all external integration. Every response uses the same envelope:

```jsonc
{ "error": false, "message": "human-readable status", "data": { /* … */ } }
```

On failure, `error` is `true` and `data` is `null`. Error messages are written
for end users — they never expose raw provider responses, stack traces, or keys.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe (used by the Railway healthcheck) |
| `POST` | `/api/heatmap` | Generate a heatmap for a polygon AOI — supports `tcm`, `time_of_measure`, `exceedance`, `persistence` |
| `POST` | `/api/route` | Plain routing: fastest route for an origin/destination/profile |
| `POST` | `/api/route-risk` | **The product endpoint** — routes + heat analysis + scores + recommendation |

### `POST /api/route-risk`

Request:

```jsonc
{
  "origin":      { "latitude": 33.4484, "longitude": -112.0740 },
  "destination": { "latitude": 33.4534, "longitude": -112.0601 },
  "date":        "2026-08-20",   // YYYY-MM-DD, 2021-01-01 … today
  "startTime":   "14:00",         // optional, HH:MM (defaults to 00:00)
  "endTime":     "16:00",         // optional, HH:MM (defaults to 23:00)
  "threshold":   30,              // optional, °C (default 30)
  "direction":   "above",         // optional: "above" | "below"
  "granularity": 100,             // optional: 60 | 80 | 100 metres
  "profile":     "foot-walking"   // optional: foot-walking | driving-ohc | cycling-regular
}
```

Response `data` contains the compared routes, the per-route heat analysis and
risk scores, and the recommendation with its measured tradeoff.

<!-- TODO(api): the per-route response shape is defined in
     packages/shared/src/route-risk.ts (AnalyzedRoute, RiskAssessment,
     RouteTradeoff). Paste a real redacted response here if you want a
     worked example in the README. -->

### `POST /api/heatmap`

Accepts a GeoJSON polygon AOI plus the analysis parameters (`analytic_type`,
`date`/`date_time` filter, `granularity`, `threshold`, `direction`). Useful for
inspecting the raw FortyGuard layers that the route pipeline consumes. A
FortyGuard `env_params` client is implemented at the service layer
(`services/fortyguard/envParams.ts`) but is not yet exposed through a route.

## Verification

The project is validated with:

```bash
npm run typecheck
npm run build
```

Both pass across all three workspaces. The production web build emits Vite's
chunk-size advisory (>500 kB, dominated by the MapLibre GL bundle); it is a
warning, not an error.

## Design Decisions & Scope

Decisions recorded during development, with their reasoning:

| # | Decision |
|---|---|
| **D1** | Risk scoring weights peak temperature, exceedance **and** persistence as first-class inputs. Rationale: at city scale the daily-peak snapshot is nearly flat, while hours-above-threshold still separates sites — so neither signal may be treated as auxiliary. |
| **D2** | Route comparison uses **one shared hull AOI** for all compared routes, rather than one heatmap per route. Keeps credit usage flat, puts every route on a common temperature scale, and avoids hard-refusing comparisons between distant routes. |
| **D3** | The location picker stays **open** (not restricted to U.S. only). Out-of-coverage is treated as a normal user-facing state with a plain-language message, not a crash or a raw API error. |
| **D4** | **No forecasting, anywhere.** The FortyGuard contract covers 2021-01-01 to today only, so the product cannot and does not claim future temperatures. |

## Known Limitations

Stated plainly rather than hidden:

- **Measured data only.** Analysis windows cover past dates and past hours.
  FortyGuard publishes with processing latency, so same-day requests often
  complete with no data — the date picker therefore defaults a few days back,
  while today remains selectable.
- **U.S.-only heat coverage.** FortyGuard covers the United States. Points
  outside coverage produce a plain-language message, not data.
- **Plan area cap.** A comparison submits one shared hull within the FortyGuard
  Basic plan cap (~10 mi²). When compared routes span more area than the cap,
  padding is dropped and the unpadded box is used, with a logged warning —
  comparison proceeds rather than refusing (decision D2).
- **Demo-scope CORS.** The backend currently enables CORS openly. That is
  appropriate for local and demo use; it would need tightening before a
  production deployment.
- **Cost and latency.** A single route-risk request can cost credits and take
  tens of seconds, because three asynchronous FortyGuard activities must be
  submitted and polled. Single-flight dedupe and short-TTL caching mitigate
  repeats, not first-time cost.
- **No automated test suite.** Verification is `typecheck` + `build`. The
  deterministic core (risk scoring, tile sampling, response normalization) is
  written to be directly unit-testable; adding a runner was out of scope for
  the hackathon build.
- **Provider dependency.** Results depend on FortyGuard and OpenRouteService
  availability. Failures surface as plain-language messages — fallback or mock
  heat data is never fabricated in the production path.

## Credits & Attribution

Aither is a solo project by **[Abdrahman Walied Mussa](https://github.com/abdrahman-dev)**,
built for the **FortyGuard Global AI Hackathon**.

- **FortyGuard** — Temperature API (`/v1/heatmap`, `/v1/env_params`,
  `/v1/status`): the sole source of hyperlocal heat data, and the basis of this
  submission.
- **OpenRouteService** — Directions API: route geometry and alternatives.
- **CARTO** — Voyager basemap style, used under CARTO's free-tier terms with
  required attribution rendered on the map.
- **OpenStreetMap** contributors — underlying map data.
- **MapLibre GL JS** — open-source map rendering (the open-source fork of
  Mapbox GL JS).
- **Nunito** (Google Fonts) — interface typeface.

## License

[MIT](LICENSE) © 2026 Abdrahman Walied Mussa