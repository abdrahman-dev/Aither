# Aither

> **Urban Heat Intelligence & Heat-Aware Routing**

Aither is a web application built for the **FortyGuard Hackathon '26**.
It combines FortyGuard's hyperlocal temperature intelligence with route
analysis to help users understand heat risk and choose safer, cooler
routes through urban environments.

**Core idea:**

> **Know where the heat is. Find the cooler way through it.**

------------------------------------------------------------------------

## 1. Project Overview

Aither is intentionally designed as a focused, realistic product rather
than an autonomous-agent platform.

The product combines three connected capabilities:

1.  **Heat Risk Dashboard** --- visualize high-resolution heat
    conditions and inspect heat risk at locations.
2.  **Heat-Aware Route Planner** --- compare routes based on heat
    exposure, not distance alone.
3.  **Trip-Time Heat Evaluation** --- evaluate expected heat
    conditions during a planned trip using FortyGuard's historical catalog
    (2021-01-01 to today). **There is no forecasting (D4):** the
    departure-time picker allows past hours of the current day only, never
    future times.

The product is primarily aligned with **Track 1 --- Resilient Cities &
Infrastructure**, while also fitting FortyGuard's documented
smart-mobility and logistics use cases.

FortyGuard's documentation explicitly lists thermal-comfort-based
routing and forecasted heat zones as a smart-mobility use case.

------------------------------------------------------------------------

# 2. Problem

Traditional route planners optimize primarily for:

-   distance
-   travel time
-   traffic
-   road restrictions

For pedestrians and outdoor workers, another factor can be critical:

**heat exposure.**

Two routes with similar distances can have very different thermal
conditions because of local temperature variation.

Aither treats temperature as a first-class routing signal.

Instead of asking only:

> "What is the fastest route?"

Aither asks:

> "What is the best route when heat exposure matters?"

------------------------------------------------------------------------

# 3. Product Vision

Aither turns raw temperature intelligence into a simple decision-making
workflow.

``` text
User
 │
 ├── Explore an area
 │
 ├── Inspect heat risk
 │
 └── Plan a trip
        │
        ▼
   Aither Heat Engine
        │
        ├── Temperature data
        ├── Heat statistics
        ├── Trip-time data
        └── Route geometry
        │
        ▼
 Heat Exposure Analysis
        │
        ▼
 Recommendation
```

The goal is not to replace a conventional routing provider.

The goal is to add a **thermal intelligence layer** on top of routing.

------------------------------------------------------------------------

# 4. Target Users

## Primary

### Pedestrians

People walking through hot urban areas who want to reduce heat exposure.

### Outdoor Workers

Workers moving between sites where exposure to high temperatures can
affect safety and productivity.

### Urban Operations Teams

Organizations managing multiple locations and needing to identify
high-risk areas.

## Secondary

-   logistics teams
-   city planners
-   public-space operators
-   campus operators
-   event organizers
-   property and asset managers

These are product directions. The initial MVP remains focused on
heat-aware urban routing and location risk visualization.

------------------------------------------------------------------------

# 5. Core User Experience

## 5.1 Heat Map

The user selects an area and time.

Aither requests a FortyGuard heatmap and displays the returned GeoJSON
temperature tiles on the map.

Example:

``` text
                    HEAT MAP

             41°   42°   43°
          ┌─────┬─────┬─────┐
          │ 🟧  │ 🟥  │ 🟥  │
          ├─────┼─────┼─────┤
          │ 🟨  │ 🟧  │ 🟥  │
          ├─────┼─────┼─────┤
          │ 🟩  │ 🟨  │ 🟧  │
          └─────┴─────┴─────┘
```

The exact visual scale will be determined by the frontend
implementation.

------------------------------------------------------------------------

# 6. Heat Risk Analysis

Aither should provide a simple, understandable risk classification.

``` text
LOW
MODERATE
HIGH
CRITICAL
```

The classification should be deterministic and explainable.

It should not depend on an LLM.

The initial risk engine can use:

-   temperature severity
-   threshold exceedance
-   persistence
-   optional environmental parameters

FortyGuard's heatmap endpoint supports:

-   `tcm`
-   `time_of_measure`
-   `exceedance`
-   `persistence`

For `exceedance` and `persistence`, the API also supports a configurable
temperature threshold and threshold direction.

------------------------------------------------------------------------

# 7. Location Details

Selecting a point or relevant map area should expose a concise risk
panel.

Example:

``` text
Downtown Phoenix

Current temperature
39.4°C

Peak temperature
43.1°C

Heat Risk
HIGH

Hours above threshold
6.2 h

Longest continuous exposure
4.0 h

[ Find Cooler Route ]
```

The exact fields displayed depend on the available FortyGuard response
data.

------------------------------------------------------------------------

# 8. Heat-Aware Routing

This is the central differentiating feature.

The user enters:

``` text
From: Location A
To: Location B
Departure: 3:00 PM
```

Aither obtains route geometry from a routing source and evaluates the
route against FortyGuard temperature data.

Conceptually:

``` text
Route
 │
 ├── Segment 1 ── Temperature
 ├── Segment 2 ── Temperature
 ├── Segment 3 ── Temperature
 ├── Segment 4 ── Temperature
 └── Segment N ── Temperature
```

Each segment receives a heat exposure value.

The system then aggregates the segment values into a route-level score.

------------------------------------------------------------------------

# 9. Route Comparison

Aither should compare routes using both conventional routing information
and heat exposure.

Example:

``` text
FASTEST ROUTE
2.3 km
31 min
Heat exposure: HIGH

COOLER ROUTE
2.6 km
35 min
Heat exposure: LOW

Recommended:
+4 minutes
-38% estimated heat exposure
```

The exact percentage must be calculated from actual route-analysis
results. It must never be hard-coded for the demo.

------------------------------------------------------------------------

# 10. Route Scoring

Aither's route score should remain deterministic.

A conceptual model:

``` text
Route Heat Exposure
=
weighted exposure across route segments
```

Possible factors:

``` text
temperature
+
duration
+
time-specific heat
+
threshold exceedance
```

A future version may incorporate:

``` text
heat index
apparent temperature
humidity
wet-bulb temperature
solar irradiance
```

The first implementation should remain as simple as possible.

------------------------------------------------------------------------

# 11. Trip-Time Heat Evaluation (No Forecasting)

The canonical contract (see `docs/reference/temperature-api-quickstart`) supports
dates from **2021-01-01 to today** — it does **not** provide future-date forecast
heatmaps. Any earlier assumption of "forecast heatmaps up to 12 hours into the
future" is **not** supported by the reference implementation.

**Product rule (D4): there is no forecasting anywhere in Aither.** The
departure-time picker allows **past hours of the current day only** — never
future times — and no "12-hour forecast" framing appears anywhere in the product.

The product intent remains valid within the supported window: Aither evaluates
the heat conditions for the requested travel time rather than only a generic
"current" reading.

Example:

``` text
Trip starts: 2:00 PM
Trip ends:   2:35 PM

Aither evaluates the heat conditions
during the relevant travel period.
```

This creates an important distinction:

``` text
Current Heat
      vs
Expected Heat During Trip
```

> Route processing should use the appropriate `date_time` window and, where a
> multi-hour window is involved, the `exceedance` / `persistence` analysis
> heatmaps. The distinction between "now" and "the departure time" is expressed
> through the requested `date_time`, not through an unavailable forecast API.

------------------------------------------------------------------------

# 12. FortyGuard API Integration

## 12.1 Create Heatmap

### Endpoint

``` http
POST <FortyGuard Create Heatmap endpoint>
```

The exact URL should be taken from the official API configuration rather
than hard-coded into this product specification.

### Purpose

Generate a high-resolution thermal map for a requested area and time
range.

### Required input

``` text
polygon_aoi
date_time
```

The API documentation specifies a GeoJSON polygon for the area of
interest.

### Date support

The canonical contract (see `docs/reference/temperature-api-quickstart`) states a
date range of:

``` text
2021-01-01 → today
```

Dates before 2021 and future dates fail. There is no documented future-date
forecast support in the contract — the earlier "forecast up to 12 hours"
assumption is **not** supported by the reference implementation.

### Granularity

The documented options are:

``` text
60m
80m
100m
```

### Analysis types

The heatmap endpoint accepts an `analytic_type`:

``` text
tcm            (default)  — snapshot temperature
time_of_measure            — UTC hour-of-day (0–23) of each tile's peak
exceedance                 — hours past a threshold (requires threshold + direction)
persistence                — longest continuous run past a threshold (requires threshold + direction)
```

`exceedance` and `persistence` additionally require `threshold` (°C) and
`direction` (`"above"` / `"below"`).

### Output

The completed result contains:

``` text
map_data
stats_data
```

`map_data` is a GeoJSON `FeatureCollection`.

**The response shape branches on `analytic_type`** — Aither's backend normalizer
must handle both:

``` text
tcm:
  map_data features → { tile_id, average_temperature, min_temperature, max_temperature }  (°C)
  stats_data        → temperature_stats + distribution fields

time_of_measure / exceedance / persistence:
  map_data features → { tile_id, value }  (units in stats_data.units, currently "hour")
  stats_data        → { activity_id, analytic_type, units, n_cells, min, max, mean }
```

For `tcm`, the temperature statistics `stats_data` includes:

-   minimum
-   maximum
-   mean
-   standard deviation
-   temperature distribution
-   normalized distribution data
-   temperature frequency data

------------------------------------------------------------------------

# 13. FortyGuard Activity Model

Several FortyGuard services are asynchronous.

The application therefore needs a small activity-polling layer.

Conceptually:

``` text
POST request
    │
    ▼
activity_id
    │
    ▼
GET /status/{activity_id}
    │
    ├── Processing → continue polling
    │
    ├── Completed → consume result
    │
    └── Failed → handle error
```

Polling should be bounded.

The API documentation specifically states that `Completed` and `Failed`
are terminal states.

------------------------------------------------------------------------

# 14. Environmental Parameters

The FortyGuard Environmental Parameters endpoint is available in both
Basic and Premium plans.

It can provide metrics including:

### Thermal

-   heat index
-   apparent temperature
-   wet-bulb temperature
-   relative humidity
-   precipitation
-   cloud cover
-   elevation

### Air Quality

-   US AQI
-   PM2.5
-   PM10
-   NO2
-   CO
-   O3
-   SO2

### Solar

-   solar irradiance
-   GHI
-   DNI
-   DHI

For the initial Aither MVP, the most relevant parameters are:

``` text
heat_index_celsius
apparent_temperature_celsius
relative_humidity_percent
```

> **No count limit is documented in the reference:** the API accepts any subset
> of the 17 validated `analysis` names listed in
> `Aither_FortyGuard_API_Reference.md` §16. Do not enforce a three-parameter cap.

These should be treated as an enhancement to the core temperature-based
engine, not a dependency for the initial prototype.

------------------------------------------------------------------------

# 15. APIs We Should Use

## MVP

### Required

``` text
Create Heatmap
Check Status
Environmental Parameters
```

### External routing

Aither needs a conventional routing source to obtain route geometry.

The routing provider is intentionally kept separate from FortyGuard.

``` text
Routing Provider
      ↓
Route Geometry

FortyGuard
      ↓
Temperature Intelligence

Aither
      ↓
Heat-Aware Route Score
```

------------------------------------------------------------------------

# 16. APIs We Should NOT Depend On for the MVP

The following FortyGuard capabilities are Premium according to the
provided documentation:

``` text
Satellite View Segmentation
Street View Segmentation
Heat Intelligence
```

They may be useful for future versions, but they should not be
architectural dependencies for the first version.

This keeps Aither's MVP smaller and avoids unnecessary complexity.

------------------------------------------------------------------------

# 17. System Architecture

``` text
┌──────────────────────────────────────────┐
│              React + TypeScript          │
│                                          │
│  Map │ Heatmap │ Risk Panel │ Routes     │
└─────────────────────┬────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────┐
│               Node.js API                │
│                                          │
│  Heat Service                            │
│  Route Service                           │
│  Risk Engine                             │
│  FortyGuard Client                       │
│  Cache / Activity Manager                │
└──────────────┬───────────────┬───────────┘
               │               │
               ▼               ▼
       ┌──────────────┐ ┌───────────────┐
       │ FortyGuard   │ │ Routing       │
       │ Temperature  │ │ Provider      │
       │ API          │ │               │
       └──────────────┘ └───────────────┘
```

------------------------------------------------------------------------

# 18. Suggested Repository Structure

``` text
aither/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── heatmap/
│   │   │   │   ├── risk/
│   │   │   │   └── routing/
│   │   │   ├── map/
│   │   │   ├── api/
│   │   │   ├── types/
│   │   │   └── App.tsx
│   │   └── ...
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   │   ├── fortyguard/
│       │   │   ├── routing/
│       │   │   ├── heat/
│       │   │   └── risk/
│       │   ├── types/
│       │   ├── utils/
│       │   └── server.ts
│       └── ...
│
├── packages/
│   └── shared/
│       └── src/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── heat-scoring.md
│
├── .env.example
├── README.md
└── package.json
```

------------------------------------------------------------------------

# 19. Backend Responsibilities

The backend should hide external API details from the frontend.

The frontend should not know how FortyGuard activities work.

Instead:

``` text
Frontend
   │
   ▼
GET /api/heatmap
   │
   ▼
Backend
   │
   ├── validate request
   ├── create FortyGuard activity
   ├── poll status
   ├── normalize response
   └── return frontend-friendly data
```

This gives Aither a stable internal API even if the external API
structure changes.

------------------------------------------------------------------------

# 20. Suggested Internal API

## Heatmap

``` http
POST /api/heatmap
```

Request:

``` json
{
  "polygon": {},
  "date": "2026-08-20",
  "startTime": "15:00",
  "endTime": "16:00",
  "analysis": "tcm",
  "granularity": 60
}
```

Response:

``` json
{
  "map": {},
  "statistics": {
    "min": 0,
    "max": 0,
    "mean": 0
  }
}
```

The exact request/response schema should be finalized against the live
FortyGuard API documentation before implementation.

------------------------------------------------------------------------

## Location Risk

``` http
GET /api/risk
```

Conceptual response:

``` json
{
  "risk": "high",
  "score": 78,
  "temperature": 39.4,
  "peakTemperature": 43.1,
  "exceedanceHours": 6.2,
  "persistenceHours": 4
}
```

------------------------------------------------------------------------

## Route Analysis

``` http
POST /api/routes/analyze
```

Request:

``` json
{
  "origin": {
    "lat": 0,
    "lng": 0
  },
  "destination": {
    "lat": 0,
    "lng": 0
  },
  "departureTime": "2026-08-20T15:00:00"
}
```

Response:

``` json
{
  "recommendedRouteId": "route-2",
  "routes": [
    {
      "id": "route-1",
      "distanceMeters": 2300,
      "durationSeconds": 1860,
      "heatExposure": 0.78,
      "risk": "high"
    },
    {
      "id": "route-2",
      "distanceMeters": 2600,
      "durationSeconds": 2100,
      "heatExposure": 0.48,
      "risk": "low"
    }
  ]
}
```

These are internal Aither schemas, not FortyGuard API schemas.

------------------------------------------------------------------------

# 21. Heat Risk Engine

The first implementation should be deterministic.

Example conceptual scoring:

``` text
temperatureScore
thresholdExposureScore
persistenceScore
```

Then:

``` text
riskScore =
    temperatureScore * tempWeight
  + thresholdExposureScore * exceedanceWeight
  + persistenceScore * persistenceWeight
```

> **Product rule (D1): the peak-temperature term and the
> threshold-exceedance/persistence terms are both first-class inputs.** The
> scoring must not let temperature dominate; concrete weights (e.g. a `0.5 / 0.3 /
> 0.2` split) are **provisional and tunable**. The reference's own "parcel scale
> vs. city scale" finding shows the daily-peak snapshot is nearly flat below city
> scale (≈0.90–0.94 °C spread) while hours-above-threshold still separates sites
> (6.5–15.2 h) — which is why route-segment scores must consume both signals.

Example classification:

``` text
0–24   LOW
25–49  MODERATE
50–74  HIGH
75–100 CRITICAL
```

These weights and thresholds are **initial product parameters**, not
FortyGuard-defined values.

They must be calibrated using actual API responses before being
presented as meaningful risk measurements.

------------------------------------------------------------------------

# 22. Route Heat Exposure

A route is represented as a sequence of spatial segments.

For each segment:

``` text
segment temperature
segment duration
segment exposure
```

A basic weighted model combines both first-class signals (D1):

``` text
segmentExposure =
    temperatureTerm
  + exceedancePersistenceTerm
```

where each term is the corresponding normalized heatmap value weighted by the
time spent in the segment:

``` text
normalizedPeakTemperature × segmentDuration
normalizedExceedanceOrPersistenceHours × segmentDuration
```

Then:

``` text
routeExposure =
    Σ segmentExposure
```

This gives us a simple and explainable comparison.

The system should normalize the exposure values before presenting
relative percentages.

------------------------------------------------------------------------

# 23. Recommendation Logic

Aither should not automatically choose the longest route simply because
it is cooler.

The recommendation should balance:

``` text
Heat Exposure
+
Travel Time
+
Distance
```

Conceptually:

``` text
routeScore =
    heatExposure * heatWeight
  + duration * timeWeight
  + distance * distanceWeight
```

The exact weights should be tested during development.

The UI should explain the tradeoff:

``` text
Recommended Route

+4 min
+300 m
38% lower estimated heat exposure
```

------------------------------------------------------------------------

# 24. Frontend Screens

## Dashboard

Main map-based experience.

``` text
┌────────────────────────────────────────────┐
│ AITHER                          [Profile]  │
├────────────────────────────────────────────┤
│                                            │
│  🔥 Heat Risk Map                          │
│                                            │
│              MAP                           │
│                                            │
│      🟥 🟥 🟧                              │
│    🟧 🟨 🟩                                │
│      🟨 🟩 🟩                              │
│                                            │
├────────────────────────────────────────────┤
│ Search location                             │
│ [________________________]                 │
│                                            │
│ Current Risk: HIGH                         │
│ Temperature: 39.4°C                        │
└────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## Route Planner

``` text
FROM
[________________]

TO
[________________]

DEPARTURE
[ 03:00 PM ]

[ Analyze Routes ]
```

Results:

``` text
FASTEST
2.3 km · 31 min
HIGH heat exposure

COOLER
2.6 km · 35 min
LOW heat exposure

RECOMMENDED
```

------------------------------------------------------------------------

# 25. Visual Design Direction

Aither should look like a modern climate-intelligence product.

The visual language should communicate:

``` text
Technical
Data-driven
Urban
Clean
Professional
```

Avoid making it look like:

-   a generic weather app
-   a gaming UI
-   an AI chatbot
-   a generic map clone

The map and thermal visualization should be the visual centerpiece.

------------------------------------------------------------------------

# 26. Optional AI Layer

AI is deliberately **not part of the core architecture**.

If time allows, Aither can use an LLM to generate natural-language
explanations from already-calculated structured results.

Example input:

``` json
{
  "location": "Warehouse 17",
  "temperature": 39.4,
  "peak": 43.1,
  "exceedanceHours": 6.2,
  "risk": "high"
}
```

Example output:

``` text
This location has high heat exposure, with temperatures
remaining above the configured threshold for several hours.
Outdoor activity is likely to be less exposed before 11 AM
or later in the afternoon.
```

The LLM should never be responsible for:

-   calculating temperature
-   deciding the numeric risk score
-   inventing API data
-   choosing a route without the deterministic route engine

The AI layer is an explanation layer.

------------------------------------------------------------------------

# 27. Error Handling

The backend should handle:

``` text
Invalid polygon
Invalid coordinates
Invalid date
Date outside supported range
FortyGuard activity failure
FortyGuard timeout
Missing heatmap data
Missing route data
Routing provider failure
Rate limits
```

Missing environmental values must not be interpreted as zero.

The FortyGuard documentation explicitly states that new missing numeric
values are returned as JSON `null`.

------------------------------------------------------------------------

# 28. Security

The FortyGuard API key must never be exposed to the browser.

Correct:

``` text
Browser
   ↓
Aither Backend
   ↓
FortyGuard
```

Incorrect:

``` text
Browser
   ↓
FortyGuard API
```

Environment variable:

``` env
FORTYGUARD_API_KEY=
```

Never:

``` text
commit the key
hard-code the key
expose the key in frontend JavaScript
```

------------------------------------------------------------------------

# 29. Performance Strategy

The main performance concern is repeated heatmap requests.

**Route comparison uses one shared hull (D2):** a single heatmap request covers a
hull spanning all compared routes — not one heatmap per route, and no hard
refusal when routes are far apart. The hull must stay within the active plan cap
(Basic 10 mi², Premium 50 mi²), which controls credit usage and places every
route on a common temperature scale.

Aither should:

-   cache identical heatmap requests
-   normalize requested areas
-   avoid unnecessary repeated polling
-   avoid requesting larger areas than necessary
-   reuse heatmap data when multiple routes overlap

A route analysis should ideally reuse an existing heatmap rather than
requesting a new heatmap for every route segment.

------------------------------------------------------------------------

# 30. MVP Scope

The MVP is complete when a user can:

``` text
1. Select an urban area.
2. Generate a FortyGuard heatmap.
3. View temperature data on a map.
4. Select a location.
5. See heat-risk information.
6. Enter a destination.
7. Compare multiple routes.
8. See heat exposure for each route.
9. Receive a recommended route.
10. Evaluate heat exposure for a trip time selected from **past hours of the current day** (no future/forecast times).
```

Anything beyond this is optional.

------------------------------------------------------------------------

# 31. Explicitly Out of Scope

For the first version, do not build:

-   autonomous agents
-   multi-agent systems
-   model training
-   custom ML forecasting
-   satellite segmentation
-   street-view segmentation
-   complex digital twins
-   large-scale fleet management
-   user accounts unless needed for deployment
-   complicated notification infrastructure

The objective is a polished, demonstrable product.

------------------------------------------------------------------------

# 32. Development Phases

## Phase 1 --- Foundation

-   initialize monorepo
-   React + TypeScript + Vite
-   Node.js backend
-   environment configuration
-   shared types
-   API client

## Phase 2 --- FortyGuard Integration

-   Create Heatmap
-   activity polling
-   Check Status
-   response normalization
-   error handling

## Phase 3 --- Map

-   map integration
-   GeoJSON rendering
-   temperature visualization
-   location selection

## Phase 4 --- Risk Engine

-   temperature scoring
-   threshold exposure
-   persistence
-   risk classification
-   location details

## Phase 5 --- Routing

-   routing provider
-   route retrieval
-   route geometry
-   segment generation
-   heat association

## Phase 6 --- Heat-Aware Routing

-   route exposure calculation
-   route comparison
-   recommendation
-   trip-time heat evaluation (no forecast)

## Phase 7 --- Polish

-   visual design
-   loading states
-   error states
-   responsive layout
-   demo scenario
-   performance optimization

## Phase 8 --- Optional AI

-   structured result → LLM
-   natural-language explanation
-   recommendation explanation

------------------------------------------------------------------------

# 33. Demo Scenario

The final demo should be extremely simple.

### Step 1

Open Aither.

### Step 2

Select a U.S. city.

> **Location search stays open (D3):** the search/autocomplete is not restricted
> to U.S. locations in the UI. The demo picks a U.S. city because that is where
> coverage lies; any out-of-coverage selection surfaces a plain-language message,
> never a raw API error.

### Step 3

Display the heatmap.

### Step 4

Select a high-risk area.

Show:

``` text
Temperature
Peak
Risk
Exposure
```

### Step 5

Choose:

``` text
From: A
To: B
Time: 3:00 PM
```

### Step 6

Click:

``` text
Find Cooler Route
```

### Step 7

Show:

``` text
FASTEST
2.3 km
31 min
HIGH

RECOMMENDED
2.6 km
35 min
LOW

-38% estimated heat exposure
```

### Step 8

Move the departure time.

``` text
3:00 PM
↓
5:00 PM
```

Show how the recommended route changes as the heat conditions at the trip
time change (past hours of the current day only — no future times, D4).

This should be the central three-minute story.

------------------------------------------------------------------------

# 34. Hackathon Positioning

Aither fits the official FortyGuard challenge because it transforms
hyperlocal temperature intelligence into a usable urban decision-making
product.

Relevant official capabilities include:

-   high-resolution heatmaps
-   historical temperature intelligence
-   current-day conditions
-   analysis heatmaps (`time_of_measure`, `exceedance`, `persistence`) for multi-hour windows
-   threshold exceedance
-   persistence analysis
-   environmental parameters

> Note: the canonical reference contract supports dates `2021-01-01` to today
> and does **not** include future-date forecasting.

The project directly aligns with the documented **Resilient Cities &
Infrastructure** direction and the documented **Smart Mobility &
Logistics** use case.

------------------------------------------------------------------------

# 35. Judging Strategy

The hackathon scoring is:

``` text
Impact & Relevance     40%
Technical Execution    35%
Innovation             15%
Communication          10%
```

Aither should optimize accordingly.

## Impact

Clearly demonstrate a real problem:

> Heat changes the quality and safety of an urban route.

## Technical Execution

Demonstrate:

-   real API integration
-   asynchronous activity handling
-   GeoJSON processing
-   spatial analysis
-   route comparison
-   deterministic scoring
-   trip-time heat evaluation (no forecast)

## Innovation

The innovation is not "we added AI."

The innovation is treating **hyperlocal heat as a routing signal**.

## Communication

The demo should communicate one simple idea:

> **The shortest route isn't always the best route when heat matters.**

------------------------------------------------------------------------

# 36. Product Principles

Aither should follow these rules:

### Data over assumptions

Use actual FortyGuard data whenever possible.

### Deterministic core

Risk and route scoring should be explainable.

### AI as augmentation

AI can explain results, but should not fabricate or control the core
analysis.

### Small surface area

Build fewer features and make them polished.

### Commercial mindset

Every major feature should answer:

> "Who would actually use this?"

### Clear tradeoffs

Never claim that the cooler route is simply "better."

Show:

``` text
distance
time
heat exposure
```

and explain the tradeoff.

------------------------------------------------------------------------

# 37. Final Product Definition

## Aither

**A heat-intelligent urban routing platform that combines hyperlocal
temperature maps, heat-risk analysis, and heat-aware route planning.**

### Core flow

``` text
                    AITHER

       ┌─────────────────────────┐
       │   Hyperlocal Heat Map   │
       └────────────┬────────────┘
                    │
                    ▼
       ┌─────────────────────────┐
       │    Heat Risk Engine     │
       └────────────┬────────────┘
                    │
                    ▼
       ┌─────────────────────────┐
       │   Route Heat Analysis   │
       └────────────┬────────────┘
                    │
                    ▼
       ┌─────────────────────────┐
       │ Cooler Route + Trip Time │
       └─────────────────────────┘
```

**Aither does not try to predict the weather.**

It uses FortyGuard's temperature intelligence to answer a more specific
question:

> **"Given where I need to go and when I need to go there, how can I
> reduce my exposure to urban heat?"**

------------------------------------------------------------------------

# 38. Source Notes

This specification is based primarily on the official FortyGuard API
documentation provided for the project.

Important documented API facts used here:

-   Create Heatmap is available in Basic and Premium plans.
-   Basic supports heatmaps up to 10 mi².
-   Premium supports heatmaps up to 50 mi².
-   Heatmaps return GeoJSON tile data and aggregated statistics.
-   Supported heatmap granularities are 60m, 80m, and 100m.
-   Valid date range is 2021-01-01 to today (per the canonical reference
    implementation); earlier and future dates fail.
-   Forecast heatmaps are **not** supported by the reference contract.
-   Heatmap analytics include temperature snapshot (`tcm`), time of peak
    (`time_of_measure`), exceedance, and persistence; the analysis types
    return a `value` per tile with units in `stats_data.units` rather than
    the `tcm` temperature fields.
-   Environmental Parameters are available in Basic and Premium.
-   Satellite Segmentation, Street View Segmentation, and Heat
    Intelligence are Premium.
-   Activity status is checked using an activity ID; the raw status string is
    matched case-insensitively against terminal sets (`completed`/`succeeded`
    success, `failed`/`error` failure).
-   Missing numeric environmental values represented by `null` must not
    be interpreted as zero.

The provided hackathon brief additionally states that the event is
U.S.-only and explicitly lists cool-route planning and public-asset heat
auditing as examples under Resilient Cities & Infrastructure.

------------------------------------------------------------------------

# 39. Implementation Rule

Before writing production integration code, verify every external
request against the live FortyGuard API documentation.

Do not invent:

-   endpoint URLs
-   request fields
-   response fields
-   authentication behavior
-   plan availability

The Aither internal API may use its own normalized schemas, but the
FortyGuard adapter must follow the official API contract exactly.

------------------------------------------------------------------------

## Aither --- MVP Summary

``` text
Heatmap
   +
Risk Analysis
   +
Route Comparison
   +
Heat Exposure
   +
Trip-Time Heat Evaluation
   =
AITHER
```

**Simple enough to build.\
Technical enough to impress.\
Focused enough to finish.**
