# Aither — FortyGuard API Reference

> **Internal API Reference — MVP Only**
>
> This document is the **primary and only FortyGuard API reference for Aither's MVP implementation**.
>
> It intentionally contains only the FortyGuard endpoints and fields that Aither is expected to use.
>
> Source: the official FortyGuard API documentation provided for the project, superseded where noted by the official reference implementation vendored at `docs/reference/temperature-api-quickstart` (Python client + notebooks + cached responses). Consult the vendored reference before writing any FortyGuard integration code.

---

## 1. Scope

Aither's MVP uses exactly three FortyGuard endpoints:

| Endpoint | Method | Purpose | Plan |
|---|---|---|---|
| `/v1/heatmap` | `POST` | Generate the thermal map used by the dashboard and route analysis | Basic / Premium |
| `/v1/env_params` | `POST` | Retrieve environmental parameters for selected locations/times | Basic / Premium |
| `/v1/status/{activity_id}` | `GET` | Poll asynchronous FortyGuard activities until completion | Basic / Premium |

### Explicitly NOT used by Aither MVP

The following endpoints are outside the MVP and must not be implemented unless the project scope is explicitly changed:

- `/v1/satellite`
- `/v1/streetview`
- `/v1/heat_intelligence`

The provided documentation marks Satellite View Segmentation, Street View Segmentation, and Heat Intelligence as Premium capabilities where applicable.

---

# 2. Base URL

```text
https://api.fortyguard.com
```

All requests use:

```http
api-key: YOUR_FORTYGUARD_API_KEY
```

The API key must exist **only on the Aither backend**.

Never expose it to the React frontend.

Correct:

```text
React
  ↓
Aither Backend
  ↓
FortyGuard
```

Incorrect:

```text
React
  ↓
FortyGuard
```

---

# 3. API Response Convention

FortyGuard responses follow one envelope (matching the reference client in
`docs/reference/temperature-api-quickstart`, which reads only `error`, `message`,
and `data` from the JSON body):

```json
{
  "error": false,
  "message": "Message",
  "data": {}
}
```

> **There is no `status_code` field in the JSON body — the HTTP status code
> carries that information.** Do not type or parse a body-level `status_code`.

For asynchronous analysis endpoints, the initial submission returns an
`activity_id` (not the final result):

```json
{
  "error": false,
  "message": "Heatmap Submitted Successfully",
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df"
  }
}
```

The `activity_id` is then used with:

```http
GET /v1/status/{activity_id}
```

On a completed activity, `data` additionally carries `status` and `result` (see
§8, §20, §21). `message` may be absent on success; when `error` is truthy,
`message` carries the failure text. Raw `status` strings must be matched
case-insensitively against the terminal sets in §22.

---

# 4. Aither's FortyGuard Workflow

All three endpoints fit into this workflow:

```text
                 AITHER BACKEND
                       │
                       ▼
              POST /v1/heatmap
                       │
                       ▼
                 activity_id
                       │
                       ▼
          GET /v1/status/{activity_id}
                       │
              ┌────────┴────────┐
              │                 │
          Processing         Completed
              │                 │
              │                 ▼
              │          map_data
              │          stats_data
              │
              └────── poll again
```

For environmental data:

```text
POST /v1/env_params
        │
        ▼
   activity_id
        │
        ▼
GET /v1/status/{activity_id}
        │
        ▼
 environmental result
```

---

# 5. Create Heatmap

## Endpoint

```http
POST https://api.fortyguard.com/v1/heatmap
```

## Purpose

Generate a hyperlocal thermal map for a polygon area at a requested date/time.

This is the **primary FortyGuard endpoint for Aither**.

Aither uses the resulting heatmap for:

1. Dashboard visualization.
2. Location heat-risk analysis.
3. Route segment heat analysis.
4. Route analysis at a selected travel time within the supported date range.
5. Analysis heatmaps (`exceedance` / `persistence`) for route exposure during multi-hour windows.

> Note: the canonical contract supports `2021-01-01` to today. Future/forecast dates are not supported — treat any "forecast" product claim as unavailable until the contract changes.

---

## 5.1 Headers

```http
api-key: YOUR_FORTYGUARD_API_KEY
Content-Type: application/json
```

---

## 5.2 Request Body

Minimum documented structure:

```json
{
  "polygon_aoi": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [-74.0170, 40.7050],
              [-74.0030, 40.7050],
              [-74.0030, 40.7180],
              [-74.0170, 40.7180],
              [-74.0170, 40.7050]
            ]
          ]
        }
      }
    ]
  },
  "date_time": {
    "start_date": "2024-07-15",
    "start_time": "14:00",
    "filter_type": 1
  },
  "granularity": 100,
  "analytic_type": "tcm"
}
```

Full documented field set:

| Field | Type | Notes |
|---|---|---|
| `polygon_aoi` | GeoJSON `FeatureCollection` | One or more Polygon features; coordinates `[longitude, latitude]` |
| `date_time` | object | `start_date`, `filter_type`, plus matching `start_time` / `end_time` / `end_date` per filter type |
| `granularity` | int | `60`, `80`, or `100` meters |
| `analytic_type` | string | `tcm` (default), `time_of_measure`, `exceedance`, or `persistence` |
| `threshold` | number | °C; **required** for `exceedance` and `persistence`, ignored otherwise |
| `direction` | string | `"above"` or `"below"`; **required** for `exceedance` and `persistence`, ignored otherwise |

> **Coverage is U.S. only.** Polygons/points outside the U.S. return errors or empty results.
>
> **Valid date range is `2021-01-01` to today.** Earlier dates and future `start_date` values fail with a "no data available" style error. Forecast dates are not supported by this contract.
>
> **Basic plan heatmaps are capped at 10 mi²; Premium at 50 mi².**
>
> **AOI sizing for route comparison (D2):** use **one shared hull** covering all compared routes in a single request — not a separate heatmap per route, and not a hard refusal when routes are far apart. Keeping the hull within the plan cap controls credit usage and places every route on a common temperature scale.
>
> **Credit usage endpoints:** `POST /v1/system/fetch-api-key-usage` (current billing-cycle summary) and `POST /v1/system/fetch-api-key-custom-usage` (custom window, `YYYY-MM-DD` dates) are available should the backend need to surface remaining credits.

---

## 5.3 `polygon_aoi`

The area of interest is supplied as a GeoJSON `FeatureCollection`.

The example contains one Polygon feature.

### Important

GeoJSON coordinates use:

```text
[longitude, latitude]
```

not:

```text
[latitude, longitude]
```

Example:

```json
[-74.0170, 40.7050]
```

means:

```text
longitude = -74.0170
latitude  = 40.7050
```

The polygon must be closed by repeating its first coordinate at the end.

---

## 5.4 `date_time`

Example:

```json
{
  "start_date": "2024-07-15",
  "start_time": "14:00",
  "filter_type": 1
}
```

Aither uses this field to request the heat conditions relevant to the requested travel time.

For the route planner, the selected departure/travel time should be passed here.

### `filter_type`

| `filter_type` | Meaning | Required date_time fields |
|---|---|---|
| `1` | Single hour | `start_date`, `start_time` |
| `2` | Range of hours (same day) | `start_date`, `start_time`, `end_time` |
| `3` | Single day (full 24 h) | `start_date` only (`start_time` ignored) |
| `4` | Range of days (window capped ~31 days) | `start_date`, `end_date` |

> **Default: `filter_type=3` (single day)** for heatmap requests when the feature
> does not otherwise drive a choice. One type-3 call yields both the daily peak
> (for ranking / AOI stats) and the full diurnal series (for peak-hour and swing
> analysis) in a single request — both signals feed the risk engine (D1).

### Example

User selects:

```text
Departure: 3:00 PM
```

Aither requests:

```json
{
  "date_time": {
    "start_date": "2026-08-20",
    "start_time": "15:00",
    "filter_type": 1
  }
}
```

> The valid date range is `2021-01-01` to today. Dates outside that range fail. There is no documented future-date/forecast support in this contract.

---

## 5.5 `analytic_type`

`create_heatmap` accepts an `analytic_type` that changes both the request payload and the response shape:

### Analysis heatmap types

| `analytic_type` | What it measures | Units | Extra required params |
|---|---|---|---|
| `tcm` *(default)* | Snapshot temperature | °C | — |
| `time_of_measure` | UTC hour-of-day (0–23) of the tile's peak | hour | — |
| `exceedance` | Count of hours the tile spends past `threshold` (a count, not degree-hours) | hour | `threshold` (°C), `direction` |
| `persistence` | Longest continuous run of such hours | hour | `threshold` (°C), `direction` |

`direction` is `"above"` or `"below"`. Both `threshold` and `direction` are required for `exceedance` and `persistence`, and ignored for `tcm` / `time_of_measure`.

> `threshold` is in **°C** (API default 30 °C), consistent with the `tcm` tile temperatures.
>
> `exceedance` counts **hours**, not degree-hours. A value of `6.0` means the tile spent six hours past the threshold.

---

## 5.6 `granularity`

Example:

```json
{
  "granularity": 100
}
```

Aither should use:

```text
60
80
100
```

only when supported by the active FortyGuard plan/API configuration.

For the initial implementation, use:

```text
100
```

unless there is a demonstrated reason to request a finer granularity.

> **Granularity cost trade-off:** for a ~104 km² AOI, `100` m ≈ 10,000 tiles,
> `80` m ≈ 16,500 tiles, `60` m ≈ 28,000 tiles. Smaller granularity means more
> tiles, longer runtime, and **higher credit cost**. This trade-off interacts
> directly with AOI sizing (D2) — choose the coarsest granularity that answers
> the question.

---

# 6. Create Heatmap — Example

## Python

```python
import requests

response = requests.post(
    "https://api.fortyguard.com/v1/heatmap",
    headers={
        "api-key": "your_api_key"
    },
    json={
        "polygon_aoi": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-74.0170, 40.7050],
                            [-74.0030, 40.7050],
                            [-74.0030, 40.7180],
                            [-74.0170, 40.7180],
                            [-74.0170, 40.7050]
                        ]]
                    }
                }
            ]
        },
        "date_time": {
            "start_date": "2024-07-15",
            "start_time": "14:00",
            "filter_type": 1
        },
        "granularity": 100
    }
)

print(response.json())
```

---

# 7. Heatmap Submission Response

The initial request does **not** contain the final heatmap — only the
`activity_id`.

Example (envelope per §3 — no body-level `status_code`):

```json
{
  "error": false,
  "message": "Heatmap Submitted Successfully",
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df"
  }
}
```

Aither must save:

```text
data.activity_id
```

and use it to poll the status endpoint.

---

# 8. Heatmap Completed Result

When the activity reaches a terminal success state, the status response contains:

```json
{
  "error": false,
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df",
    "status": "completed",
    "result": {
      "map_data": {},
      "stats_data": {}
    }
  }
}
```

There is **no `status_code` field in the JSON body**; the HTTP status carries it
(see §3). The raw `status` string is matched case-insensitively against the
terminal sets in §22 (`completed`/`succeeded` success, `failed`/`error` failure).

The important fields for Aither are:

```text
data.result.map_data
data.result.stats_data
```

## 8.1 The result shape branches on `analytic_type`

There are **two distinct heatmap result shapes**. The backend normalizer must inspect `analytic_type` (echoed in `stats_data` for analysis heatmaps; the value the request was made with for `tcm`) and branch accordingly. Code that assumes a single flat shape will misread analysis heatmaps.

### `tcm` (default) — temperature snapshot

- Each tile feature's `properties` carries `tile_id` plus temperature fields in **°C**:
  - `average_temperature`, `min_temperature`, `max_temperature` (single-day / multi-day windows; `filter_type` 3/4)
  - `temperature` (single-value snapshots; `filter_type` 1/2)
- `stats_data` carries `temperature_stats` (`minimum`, `maximum`, `mean`, `standard_deviation`) and distribution fields (`overall_temperature_distribution`, `normal_temperature_distribution` with `x_axis`/`y_axis`, `temperature_frequency` with `x_axis`/`y_axis`).

> **tcm tiles never include per-hour `'00'..'23'` fields.** For `filter_type` 1/2 a
> tile carries a single `temperature` field; for `filter_type` 3/4 it carries
> `average_temperature` / `min_temperature` / `max_temperature`. No parser should
> expect an hourly dict on a `tcm` response (confirmed against the reference's
> cached responses; see also reference notebook `01_create_heatmap.ipynb`).

### `time_of_measure` / `exceedance` / `persistence` — analysis heatmaps

- Each tile feature's `properties` carries only `tile_id` and `value`. The `value` is interpreted using `stats_data.units` (currently `"hour"`).
- `stats_data` carries `activity_id`, `analytic_type`, `units`, `n_cells`, `min`, `max`, `mean` — **not** `temperature_stats` or the distribution fields.

Example `stats_data` from the reference data for `exceedance`:

```json
{
  "activity_id": "cc0d61e2-c9bb-44de-83aa-050f8f135e64",
  "analytic_type": "exceedance",
  "units": "hour",
  "n_cells": 2224,
  "min": 13.0671,
  "max": 19.5726,
  "mean": 16.35928340827338
}
```

---

# 9. `map_data`

The heatmap result provides map data intended for geographic visualization.

`map_data` is a GeoJSON `FeatureCollection`. Each feature has:

- `id` — string identifier.
- `type` — `"Feature"`.
- `geometry` — a `Polygon` outlining the tile, coordinates `[longitude, latitude]`.
- `properties` — shape depends on `analytic_type` (see 8.1):
  - `tcm`: `tile_id` + temperature fields (`average_temperature` / `min_temperature` / `max_temperature`, or `temperature`).
  - analysis types: `tile_id` + `value` (interpret with `stats_data.units`).

Conceptually:

```text
FortyGuard
    ↓
GeoJSON heat data
    ↓
Aither backend (normalize per analytic_type)
    ↓
Frontend
    ↓
Map layer
```

The frontend should not need to know how the FortyGuard activity was generated.

---

# 10. `stats_data`

The completed heatmap result also contains aggregated statistics.

Aither uses this data for the heat-risk dashboard.

The shape of `stats_data` depends on `analytic_type` (see 8.1):

- `tcm`: `temperature_stats` (`minimum`, `maximum`, `mean`, `standard_deviation`) plus distribution fields.
- analysis types: `activity_id`, `analytic_type`, `units`, `n_cells`, `min`, `max`, `mean`.

The dashboard can expose relevant statistics returned by FortyGuard rather than inventing values.

Possible presentation:

```text
Selected Area

Minimum       XX.X°C
Maximum       XX.X°C
Mean          XX.X°C
```

Only display fields actually present in the received response.

---

# 11. Environmental Parameters

## Endpoint

```http
POST https://api.fortyguard.com/v1/env_params
```

## Purpose

Retrieve additional environmental parameters for a specific location and time.

Aither uses this as a **secondary analysis layer**.

The heatmap remains the core data source.

---

# 12. Environmental Parameters Request

## Headers

```http
api-key: YOUR_FORTYGUARD_API_KEY
Content-Type: application/json
```

## Request

```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "temperature": 32.5,
  "date_time": {
    "start_date": "2024-07-15",
    "start_time": "14:00",
    "filter_type": 1
  }
}
```

`date_time` uses the same `filter_type` semantics as the heatmap endpoint (see 5.4).

The optional `analysis` array restricts the response to a subset of parameters (e.g. `["heat_index_celsius", "apparent_temperature_celsius", "relative_humidity_percent"]`). **The exact accepted names are the 17 validated params listed in §16.** The client should validate `analysis` entries against that set before sending (the reference client does).

---

# 13. Environmental Parameters Example

## Python

```python
import requests

response = requests.post(
    "https://api.fortyguard.com/v1/env_params",
    headers={
        "api-key": "your_api_key"
    },
    json={
        "latitude": 40.7128,
        "longitude": -74.0060,
        "temperature": 32.5,
        "date_time": {
            "start_date": "2024-07-15",
            "start_time": "14:00",
            "filter_type": 1
        }
    }
)

print(response.json())
```

---

# 14. Environmental Parameters Submission Response

```json
{
  "error": false,
  "message": "Environment Parameters Analysis Submitted Successfully",
  "data": {
    "activity_id": "f501e334-572b-40c4-8eb9-c9b679eff6ee"
  }
}
```

Again:

```text
activity_id
```

must be passed to the status endpoint.

---

# 15. Environmental Parameters Result

Completed response (envelope per §3 — no body-level `status_code`):

```json
{
  "error": false,
  "data": {
    "activity_id": "UUID_STRING",
    "status": "completed",
    "result": {
      "metadata": {
        "timezone": "TIMEZONE_STRING",
        "timezone_offset_hours": "NUMBER",
        "time_range": {
          "start": "YYYY-MM-DDTHH:MM:SS±HH:MM",
          "end": "YYYY-MM-DDTHH:MM:SS±HH:MM",
          "interval": "TIME_INTERVAL_STRING",
          "count": "INTEGER"
        },
        "timestamps": [
          "YYYY-MM-DDTHH:MM:SS±HH:MM"
        ]
      },
      "locations": [
        {
          "lat": "NUMBER",
          "lon": "NUMBER",
          "elevation": "NUMBER",
          "temperature": "NUMBER",
          "parameters": {},
          "solar_irradiance": {
            "clear_sky": {
              "ghi": "NUMBER",
              "dni": "NUMBER",
              "dhi": "NUMBER"
            },
            "description": "STRING"
          }
        }
      ]
    }
  }
}
```

Notes (confirmed against the reference's cached responses):

- `locations[].temperature` **echoes the `temperature` anchor** sent in the request.
- `locations[].elevation` is present (meters).
- `solar_irradiance` is **not an empty placeholder**: it carries
  `clear_sky.{ghi, dni, dhi}` (W/m² clear-sky components) plus a `description`
  string.
- `parameters` values are scalars for `filter_type=1` or arrays aligned with
  `metadata.timestamps` otherwise.

---

# 16. Environmental Parameters We Care About

The API result can contain many parameters.

Aither's MVP should focus on thermal parameters.

## Primary

```text
heat_index_celsius
apparent_temperature_celsius
relative_humidity_percent
wet_bulb_temperature_celsius
```

## Secondary / future

```text
precipitation_mm
cloud_cover_octas
solar irradiance
```

> **No count limit is documented in the reference.** The API accepts any subset
> of the following **17 validated `analysis` names** (from the reference client,
> `fortyguard/client.py`). **Do not enforce a count cap** — verify against the
> live API only if a real limit is observed at runtime:

```text
heat_index_celsius
apparent_temperature_celsius
wet_bulb_temperature_celsius
relative_humidity_percent
precipitation_mm
cloud_cover_octas
air_quality:idx
air_quality_no2:idx
air_quality_o3:idx
air_quality_pm2p5:idx
air_quality_pm10:idx
air_quality_so2:idx
aqi_us_co
methane_ppb
co2_ppm
elevation
solar_irradiance
```

A practical initial selection remains:

```text
heat_index_celsius
apparent_temperature_celsius
relative_humidity_percent
```

Do not request every parameter by default, but do not refuse a valid request just
because it names more than three parameters.

---

# 16.1 Known `env_params` Quirks

Two behaviors confirmed by the reference implementation are important for Aither's heat-risk analysis:

### `heat_index_celsius` is not a diurnal curve

The `env_params` endpoint applies the single `temperature` anchor across all 24 hours and varies only humidity. Heat index is a function of both, so the returned `heat_index_celsius` series tracks **relative humidity** — it can peak around 2 a.m. and bottom out mid-afternoon, while real air temperature is doing the opposite.

```text
heat_index_celsius            apparent_temperature_celsius
(driven by humidity,          (follows the real diurnal cycle,
 peaks overnight)              use this for time-of-day comparisons)
```

Aither must **not** use `heat_index_celsius` for time-of-day comparisons. Use `apparent_temperature_celsius` for that. It is only physically meaningful at hours when actual temperature is near the supplied anchor.

### `env_params` is coarser than the heatmap

`env_params` resolves on a weather grid coarser than the heatmap layer. Nearby locations (even parcels ~1.4 km apart) can return byte-identical arrays. It must not be used to discriminate between nearby locations — use the heatmap layers for site-to-site comparison and `env_params` to characterise a district.

---

# 17. Environmental Parameter Null Handling

The result can contain:

```json
null
```

for unavailable numeric values.

Example:

```json
{
  "heat_index_celsius": [null]
}
```

Aither must treat:

```text
null
```

as:

```text
unknown / unavailable
```

not:

```text
0
```

Never convert missing environmental data to zero.

Nulls can occur **per-sample inside array parameters** (e.g. individual entries
in a `co2_ppm` array) — not only as a whole-parameter `[null]`. Treat any array
element that is `null` as unavailable for that timestamp; drop it rather than
coercing it to `0`.

---

# 18. Check Status

## Endpoint

```http
GET https://api.fortyguard.com/v1/status/{activity_id}
```

## Purpose

Check the status of an asynchronous FortyGuard activity.

Aither uses this endpoint after:

```text
POST /v1/heatmap
```

and:

```text
POST /v1/env_params
```

---

# 19. Status Request

## Python

```python
import requests

activity_id = "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df"

response = requests.get(
    f"https://api.fortyguard.com/v1/status/{activity_id}",
    headers={
        "api-key": "your_api_key"
    }
)

print(response.json())
```

---

# 20. Processing Response

Example (envelope per §3 — no body-level `status_code`):

```json
{
  "error": false,
  "data": {
    "activity_id": "f3e1c68b-1cc3-46bc-8589-1faaf30ef30a",
    "status": "Processing"
  }
}
```

When:

```text
status = Processing
```

(and any other non-terminal value), Aither should wait and poll again.

---

# 21. Completed Response

Example (envelope per §3 — no body-level `status_code`):

```json
{
  "error": false,
  "data": {
    "activity_id": "f52d2453-6a59-4b31-afa3-8fe3bb1ac5df",
    "status": "completed",
    "result": {
      "map_data": {},
      "stats_data": {}
    }
  }
}
```

When the lowercased `status` is a terminal success (`completed` or `succeeded`,
see §22), Aither should consume:

```text
data.result
```

and stop polling.

---

# 22. Failed Activities

If the API returns a failed terminal status, Aither must stop polling and surface an appropriate error.

Conceptually:

```text
Processing
    │
    ├── Processing → poll again
    │
    ├── Completed → consume result
    │
    └── Failed → stop + report error
```

Do not poll indefinitely.

Billing context: failed tasks are **free**; credits are deducted only once a task reaches `Completed`. This is billing context and does not change error-handling behavior.

**Terminal statuses are matched case-insensitively.** Lowercase the raw `status`
string before comparing:

| Outcome | Status values (case-insensitive) |
|---|---|
| Terminal success | `completed`, `succeeded` |
| Terminal failure | `failed`, `error` |
| Keep polling | anything else (e.g. `Processing`, or any non-terminal/unknown string) |

Shortly after submission the status endpoint can briefly return 404 while the
activity propagates; treat that as retryable, not as a failure.

---

# 23. Backend Activity Helper

Aither should centralize activity polling.

Do not duplicate this logic inside every service.

Recommended TypeScript abstraction (envelope per §3 — no body-level `status_code`):

```ts
type FortyGuardActivityResponse<T> = {
  error: boolean;
  message?: string;
  data: {
    activity_id: string;
    status?: string;
    result?: T;
  };
};
```

Conceptual helper (matches terminal sets case-insensitively; see §22):

```ts
const TERMINAL_SUCCESS = new Set(["completed", "succeeded"]);
const TERMINAL_FAILURE = new Set(["failed", "error"]);

async function waitForActivity<T>(
  activityId: string
): Promise<T> {
  while (true) {
    const response =
      await fortyGuard.get<FortyGuardActivityResponse<T>>(
        `/v1/status/${activityId}`
      );

    const { status, result } = response.data.data;
    const normalized = (status ?? "").toLowerCase();

    if (TERMINAL_SUCCESS.has(normalized) && result !== undefined) {
      return result;
    }

    if (TERMINAL_FAILURE.has(normalized)) {
      throw new Error("FortyGuard activity failed");
    }

    await delay(1000);
  }
}
```

The polling interval and maximum timeout should be configured centrally. Reference
defaults (from the vendored client) are `poll_interval` = 3 s and `timeout` = 600 s
(the out-of-scope `heat_intelligence` endpoint uses 5 s / 900 s). A brief 404 from
the status endpoint right after submission should be treated as "not ready yet"
and retried rather than failing.

---

# 24. Aither's FortyGuard Client

All direct FortyGuard requests should live behind one backend client.

Recommended structure:

```text
services/
└── fortyguard/
    ├── client.ts
    ├── heatmap.ts
    ├── envParams.ts
    ├── status.ts
    └── types.ts
```

Example:

```ts
export class FortyGuardClient {
  constructor(
    private readonly apiKey: string
  ) {}

  async createHeatmap() {
    // POST /v1/heatmap
  }

  async getEnvironmentParameters() {
    // POST /v1/env_params
  }

  async getStatus(activityId: string) {
    // GET /v1/status/{activity_id}
  }
}
```

The rest of the application should depend on this client, not on raw `fetch()` calls to FortyGuard.

---

# 25. Aither Internal Flow — Heatmap

```text
User selects area + time
        │
        ▼
POST /api/heatmap
        │
        ▼
Aither Backend
        │
        ▼
POST https://api.fortyguard.com/v1/heatmap
        │
        ▼
activity_id
        │
        ▼
GET /v1/status/{activity_id}
        │
        ├── Processing → wait
        │
        └── Completed
               │
               ▼
       map_data + stats_data
               │
               ▼
          Aither frontend
```

---

# 26. Aither Internal Flow — Environmental Analysis

```text
User selects location
        │
        ▼
Aither Backend
        │
        ▼
POST /v1/env_params
        │
        ▼
activity_id
        │
        ▼
GET /v1/status/{activity_id}
        │
        └── Completed
                │
                ▼
          environmental data
                │
                ▼
          Heat Risk Engine
```

---

# 27. Aither Internal Flow — Cool Route

FortyGuard does **not** provide the complete routing workflow used by Aither.

Routing and heat intelligence are therefore separate systems.

```text
                    ROUTE REQUEST
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
      Routing Provider           FortyGuard
            │                         │
            ▼                         ▼
      Route Geometry             Heatmap
            │                         │
            └────────────┬────────────┘
                         ▼
                 Aither Heat Engine
                         │
                         ▼
                 Route Comparison
                         │
                         ▼
                  Recommendation
```

FortyGuard is responsible for:

```text
temperature intelligence
```

The routing provider is responsible for:

```text
route geometry
```

Aither combines them.

---

# 28. Example End-to-End Scenario

User wants to walk from:

```text
A
→
B
```

at:

```text
15:00
```

### Step 1 — Routing

Aither requests routes from the routing provider.

Result:

```text
Route 1
2.3 km
31 min

Route 2
2.6 km
35 min
```

### Step 2 — Heatmap

Aither creates a FortyGuard heatmap covering the route area:

```http
POST /v1/heatmap
```

with:

```text
date = requested travel date
time = 15:00
granularity = 100
```

### Step 3 — Poll

Aither receives:

```text
activity_id
```

and polls:

```http
GET /v1/status/{activity_id}
```

### Step 4 — Analyze

The returned heatmap is associated with the route segments.

Conceptually:

```text
Route 1:
🟧 🟥 🟥 🟥 🟧
HIGH exposure

Route 2:
🟩 🟩 🟨 🟨 🟩
LOW exposure
```

### Step 5 — Compare

```text
Route 1
2.3 km
31 min
HIGH

Route 2
2.6 km
35 min
LOW
```

### Step 6 — Recommend

```text
Recommended Route 2

+4 minutes
+300 meters
Lower estimated heat exposure
```

The actual exposure difference must come from the computed data.

---

# 29. API Key Configuration

Backend `.env`:

```env
FORTYGUARD_API_KEY=your_api_key
FORTYGUARD_BASE_URL=https://api.fortyguard.com
```

Never commit:

```text
.env
```

Never put the API key in:

```text
VITE_*
```

because Vite variables prefixed with `VITE_` are exposed to frontend code.

---

# 30. Rules for Aither Developers

### Rule 1

Use only the endpoints documented in this file for the Aither MVP.

### Rule 2

Do not call FortyGuard directly from React.

### Rule 3

Every asynchronous submission must use `activity_id`.

### Rule 4

Every activity must be polled through:

```http
GET /v1/status/{activity_id}
```

### Rule 5

Do not assume an initial `POST` response contains the final data.

### Rule 6

Do not convert `null` environmental values to zero.

### Rule 7

Do not invent FortyGuard response fields.

### Rule 8

Do not add Satellite, Street View, or Heat Intelligence to the MVP without an explicit scope change.

### Rule 9

The route geometry comes from the routing layer; FortyGuard supplies the heat intelligence.

### Rule 10

The frontend consumes Aither's normalized backend API, not raw FortyGuard responses.

### Rule 11

The heatmap response shape branches on `analytic_type` — normalize `tcm` and the analysis types (`time_of_measure` / `exceedance` / `persistence`) separately, never assume a single flat shape.

### Rule 12

When a FortyGuard behavior is ambiguous, consult the vendored reference implementation at `docs/reference/temperature-api-quickstart` (Python client, notebooks, and cached responses) before guessing.

---

# 31. Minimal API Surface

For Aither MVP, the FortyGuard integration is intentionally this small:

```text
POST /v1/heatmap
        ↓
GET /v1/status/{activity_id}

POST /v1/env_params
        ↓
GET /v1/status/{activity_id}
```

That's it.

```text
                AITHER
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
    HEATMAP                ENV PARAMS
       │                       │
       └───────────┬───────────┘
                   ▼
                 STATUS
```

---

# 32. Final Reference

When implementing Aither, use this document as the first reference for FortyGuard integration, alongside the vendored official reference at `docs/reference/temperature-api-quickstart`.

If an implementation requirement is not covered here, do **not** guess the FortyGuard API behavior.

Instead:

1. Check `docs/reference/temperature-api-quickstart` (the official Python client, notebooks, and cached API responses).
2. Check the official FortyGuard API documentation.
3. Confirm the exact request/response contract.
4. Update this reference if the project officially adopts the new capability.

The Aither MVP should remain limited to:

```text
/v1/heatmap
/v1/env_params
/v1/status/{activity_id}
```

Everything else is outside the current API scope.
