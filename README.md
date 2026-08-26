# Aither

Urban Heat Intelligence & Heat-Aware Routing

> Know where the heat is. Find the cooler way through it.

Aither is a web application built for the **FortyGuard Global AI Hackathon** by
**Abdrahman Walied Mussa**.

---

## What Aither Does

Conventional route planners optimize for distance and time. For pedestrians and
outdoor workers in hot cities, heat exposure matters too — and two routes with
similar lengths can have very different thermal conditions.

Aither analyzes routes between two points using **measured historical heat
data** from the FortyGuard Temperature API together with route geometry from
OpenRouteService. It scores each route option for estimated heat risk,
visualizes the options on a map, and recommends a route with an explicit,
data-derived tradeoff.

Aither uses **measured data only** — there is no forecasting anywhere in the
product. The date/time picker is restricted to past dates and past hours of the
current day.

## Core Features

- **Landing page** introducing the product before entering the planner.
- **Route planning** with origin/destination picked by clicking the map
  (lettered A/B pins) or adopted from a one-shot device GPS fix.
- **Transport modes** — walking, driving, cycling (OpenRouteService profiles).
- **Date/time analysis window** — pick a past date and hour range; today's
  hours are capped at "now" (measured data only).
- **Route comparison** — OpenRouteService returns the fastest route plus
  alternatives; all compared routes are analyzed against one shared heatmap
  area so they sit on a common temperature scale.
- **Heat risk analysis** — each route is resampled along its geometry and
  matched to FortyGuard heatmap tiles for three signals: peak temperature
  (`tcm`, full day), hours above threshold (`exceedance`), and longest
  sustained heat run (`persistence`). Routes are scored with a deterministic
  weighted formula (0.3 peak / 0.4 exceedance / 0.3 persistence, normalized
  across the compared routes) and classified low / moderate / high / critical.
- **Risk visualization** — risk-tier colored route lines on a MapLibre map with
  numbered chips tied to the results list; the recommended route is highlighted.
- **Recommendation & tradeoff** — lowest-risk route recommended, with the cost
  stated from actual computed data (extra minutes, extra meters, estimated
  exposure reduction). Percentages are never hard-coded.
- **Unavailable-data handling** — routes that cannot be matched to enough heat
  samples render as "no heat data" rather than fake scores; out-of-coverage
  locations surface a plain-language message; identical repeated requests are
  deduplicated server-side (in-flight registry + short-TTL caches).

The backend also exposes `POST /api/heatmap` (heatmap generation for a polygon
area, including the `tcm`, `time_of_measure`, `exceedance`, and `persistence`
analysis types) and `POST /api/route` (plain routing), plus `GET /api/health`.
A FortyGuard environmental-parameters client is implemented at the service
layer but not yet exposed via an API route.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Mapping | MapLibre GL JS v6 over the keyless CARTO Voyager vector basemap |
| Backend | Node.js (≥18), Express 4, TypeScript, `tsx` for development |
| HTTP | Native `fetch` (no axios) |
| Routing provider | OpenRouteService Directions API |
| Heat data provider | FortyGuard Temperature API (`/v1/heatmap`, `/v1/env_params`, `/v1/status`) |
| Storage/database | None — in-memory TTL caches only |
| Monorepo | npm workspaces |

All external API keys live in backend environment variables only. The frontend
talks exclusively to Aither's own backend and never sees provider keys or
activity polling.

## Architecture Overview

```text
User
 → Route Planner (pick points, mode, date/time window)
   → POST /api/route-risk  (Aither backend)
     → OpenRouteService directions (fastest + alternatives)
     → one shared hull AOI covering all compared routes
     → three async FortyGuard heatmaps over that AOI:
         tcm (full day) + exceedance + persistence (trip window)
     → submit activity → poll status until terminal
     → sample each route against the heatmap tiles
     → D1 risk score per route → recommendation + tradeoff
   → { error, message, data } envelope
 → Map (risk-colored routes) + Results card
```

Every FortyGuard analysis is asynchronous: the backend submits, polls
`/v1/status/{activity_id}` (case-insensitive terminal statuses, transient-error
retry, bounded by a hard deadline), then normalizes responses into shared types
before anything reaches the frontend.

## Project Structure

```text
aither/
├── apps/
│   ├── web/                  # React + Vite frontend
│   │   └── src/
│   │       ├── api/          # typed client for Aither's own backend
│   │       ├── features/
│   │       │   ├── landing/  # entry page
│   │       │   └── routing/  # planner, results card, trip-planning state
│   │       ├── map/          # MapLibre base map + route layers/markers
│   │       └── types/        # re-exports of shared contract types
│   └── api/                  # Express + TypeScript backend
│       └── src/
│           ├── routes/       # /api/heatmap, /api/route, /api/route-risk
│           ├── services/
│           │   ├── fortyguard/  # client, polling, normalization
│           │   ├── routing/     # OpenRouteService client
│           │   ├── heat/        # shared hull, sampling, route-risk pipeline
│           │   └── risk/        # D1 scoring + classification
│           └── utils/        # validation, caching, dedupe, errors
├── packages/shared/          # @aither/shared wire-contract types
└── docs/                     # project docs, phase records, design guidelines
```

## Environment Variables

Copy `.env.example` to `.env` at the repository root and fill in real values.
Never commit real secrets.

| Variable | Side | Purpose |
|---|---|---|
| `FORTYGUARD_API_KEY` | Backend only | FortyGuard API key |
| `FORTYGUARD_BASE_URL` | Backend only | Defaults to `https://api.fortyguard.com` |
| `ORS_API_KEY` | Backend only | OpenRouteService API key |
| `PORT` | Backend only | Backend port (default `3000`) |
| `VITE_API_BASE_URL` | Frontend build-time | Aither backend base URL (e.g. `http://localhost:3000`) |

The backend fails fast on startup if any required variable is missing.

## Local Development

```bash
npm install            # install all workspaces

npm run dev:api        # backend on PORT (default 3000)
npm run dev:web        # frontend on http://localhost:5173

npm run typecheck      # typecheck all three workspaces
npm run build          # build shared → api → web
```

## Verification

The project is validated with:

```bash
npm run typecheck
npm run build
```

Both pass for all three workspaces. The production web build currently emits
Vite's chunk-size advisory (>500 kB, dominated by MapLibre); it is a warning,
not an error.

## Notes & Limitations

- **Measured data only.** Analysis windows cover past dates/hours; same-day
  data may not be published yet, so the date picker defaults a few days back.
- **Plan area cap.** Route comparison submits one shared hull within the
  FortyGuard Basic plan cap (~10 mi²). When compared routes span more area than
  the cap, padding is dropped and the unpadded box is used with a logged
  warning — comparison proceeds rather than refusing (documented project
  decision D2).
- **Demo-scope CORS.** The backend currently enables CORS openly, which is
  appropriate for local/demo use and would need tightening for production.
- **Provider availability.** Results depend on FortyGuard/OpenRouteService
  availability; failures surface as plain-language messages, never fabricated
  data.

---

Built by **Abdrahman Walied Mussa** for the **FortyGuard Global AI Hackathon**.
