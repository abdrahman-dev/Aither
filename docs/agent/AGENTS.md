# AGENTS.md — Aither Agent Rules

> **Project:** Aither  
> **Purpose:** FortyGuard Hackathon '26  
> **Product:** Urban Heat Intelligence + Heat-Aware Routing  
> **Stack:** React + TypeScript + Vite + Node.js
>
> Read this file before making any change.
>
> For FortyGuard integration, `docs/project/Aither_FortyGuard_API_Reference.md` and the canonical reference client at `docs/reference/temperature-api-quickstart` are the project API references unless the user explicitly asks to change the integration contract.

---

## 1. Core Principle

Build the smallest correct implementation that moves Aither toward the defined product.

Do not turn a simple feature into a framework.

Do not add architecture because it "might be useful later."

Do not introduce an Agentic architecture just because the project contains AI-related functionality.

Do not optimize for theoretical scalability before the MVP works.

Priority:

```text
Correctness
    ↓
Product behavior
    ↓
Maintainability
    ↓
UX / polish
    ↓
Performance
    ↓
Future extensibility
```

Aither is a hackathon product. It must be technically credible, visually polished, understandable, and realistically finishable.

---

## 2. Product Definition

Aither combines:

```text
Hyperlocal Heatmap
        +
Heat Risk Analysis
        +
Heat-Aware Route Comparison
        +
Trip-Time Heat Evaluation (no forecast)
```

The central product question is:

> Given where a person needs to go and when they need to travel, how can Aither help reduce exposure to urban heat?

Aither is **not**:

- an autonomous agent platform
- a multi-agent system
- a weather forecasting model
- a generic weather dashboard
- a generic map clone
- an AI chatbot
- a custom ML research project

AI is optional and secondary.

The deterministic heat/routing system is the product.

---

## 3. Source of Truth

Before implementing anything, inspect:

```text
AGENTS.md
docs/AITHER.md
docs/project/Aither_FortyGuard_API_Reference.md
docs/reference/temperature-api-quickstart   # canonical contract (Python client + notebooks)
README.md
```

If there is a conflict:

```text
Explicit user instruction
        ↓
Current project requirements
        ↓
AGENTS.md
        ↓
docs/reference/temperature-api-quickstart (canonical FortyGuard contract)
        ↓
docs/project/Aither_FortyGuard_API_Reference.md for FortyGuard behavior
        ↓
Existing architecture and conventions
        ↓
General engineering preference
```

> **For any FortyGuard behavior, `docs/reference/temperature-api-quickstart` is
> the canonical contract source and overrides `Aither_FortyGuard_API_Reference.md`
> or any other project doc wherever they conflict.** Correct the project API
> reference to match the vendored reference — never adapt an implementation
> around a project-doc claim that contradicts the vendored reference.

Never silently override an explicit user requirement.

Never invent an external API contract.

---

## 4. User Instructions Have Priority

The user is the final authority over product behavior.

If the user explicitly says:

```text
"do this"
```

follow it unless it conflicts with a higher-priority constraint.

If the user says:

```text
"don't do X"
```

do not do X as a "better approach."

If a better approach exists, explain it briefly and let the user decide when the change materially affects architecture, scope, or behavior.

Do not silently redesign the project.

---

## 5. Before Editing

Before changing code:

1. Inspect the relevant files.
2. Understand the existing implementation.
3. Identify the smallest set of files that need modification.
4. Reuse existing abstractions where appropriate.
5. Check whether the feature already partially exists.
6. Check the project API documentation before touching external integration.
7. Determine whether the requested change affects public interfaces or shared types.

Do not immediately create new files.

Do not rewrite an existing subsystem without first understanding it.

Do not make broad refactors to solve a local problem.

---

## 6. Minimal Change Principle

Prefer:

```text
small, local, understandable change
```

over:

```text
large architectural rewrite
```

If a bug can be fixed in one function, do not rewrite the module.

If a feature needs one service, do not create five abstraction layers.

If an existing component already does the job, extend it instead of replacing it.

If a type can be reused, do not duplicate it.

---

## 6.1 Verification Scope

After implementing a feature or scaffold, verification is limited to:

- (a) the code compiles/builds successfully (`tsc`, `vite build`, or the project's existing build script),
- (b) the linter passes if one is configured, and
- (c) a brief static read-through of the changed files to confirm they match the task.

Non-negotiable:

- Do NOT spawn background dev servers (`npm run dev`, `vite`, `node server.js`, etc.) to "verify it serves."
- Do NOT launch headless browsers (Edge, Chrome, Playwright, Puppeteer, or any browser automation) for any reason — no screenshots, no DOM dumping, no rendered-output inspection.
- Do NOT write or run ad-hoc smoke-test scripts, `curl`/`Invoke-WebRequest` checks against a locally running server, or any manual integration testing not explicitly requested by the user.
- If real runtime verification is genuinely needed for a specific task, STOP and ask the user first, explaining exactly what you want to run and why — do not decide unilaterally to boot processes and inspect output.
- A finished task ends with a written summary of what changed and how the user can verify it themselves (e.g. "run `npm run dev:web` and check the map renders") — the agent does not do that verification on the user's behalf by default.
- Formal automated tests (unit/integration test files that are part of the actual codebase and requested as a deliverable) are a separate, allowed category — this rule is about ad-hoc manual QA processes the agent runs on its own initiative, not about writing real test suites when asked.

---

## 7. No Unrequested Features

Do not add:

- authentication
- user accounts
- databases
- analytics
- notifications
- admin panels
- AI agents
- background workers
- queues
- microservices
- complex caching systems
- cloud infrastructure
- CI/CD
- advanced state management

unless explicitly requested or genuinely required for the current feature.

"Future-proofing" is not a sufficient reason.

---

## 8. No Agentic Overengineering

Aither's core must remain deterministic.

Do not introduce:

```text
planner agents
tool-using agents
multi-agent orchestration
agent memory
autonomous loops
LLM-based routing
LLM-based scoring
```

for normal product functionality.

The intended architecture is:

```text
FortyGuard
    ↓
Heat Data
    ↓
Deterministic Heat Engine
    ↓
Route Heat Analysis
    ↓
Recommendation
```

If an LLM is later added, it should primarily explain already-computed structured results.

Example:

```text
Heat Engine
    ↓
{
  risk: "high",
  temperature: 39.4,
  exposureHours: 4.2
}
    ↓
LLM
    ↓
Human-readable explanation
```

Never:

```text
LLM
    ↓
invent temperature
invent risk
invent route
```

---

## 9. FortyGuard Rules

For Aither MVP, the approved FortyGuard integration surface is exactly:

```text
POST /v1/heatmap

POST /v1/env_params

GET /v1/status/{activity_id}
```

Do not use:

```text
/v1/satellite
/v1/streetview
/v1/heat_intelligence
```

unless the user explicitly changes the project scope.

### 9.1 Canonical contract reference

The official FortyGuard reference implementation is vendored at:

```text
docs/reference/temperature-api-quickstart
```

It contains the real Python client (`fortyguard/client.py`), runnable notebooks, and cached API responses (`data/`). Treat it as the canonical contract. If a behavior is documented there and conflicts with this file, report the conflict rather than silently choosing either.

### 9.2 Request constraints

- Coverage is **U.S. only**. Polygons or points outside the U.S. return errors or empty results.
- Heatmap date range is **2021-01-01 to today** (no future dates). Earlier dates fail; future `start_date` fails. Forecast heatmaps are **not** a documented feature of this contract.
- **Basic plan** heatmaps are capped at **10 mi²**; Premium up to 50 mi².
- GeoJSON coordinates are **[longitude, latitude]**.
- Granularity options: **60, 80, 100** meters. **Cost trade-off:** for a ~104 km² AOI, `100` ≈ 10k tiles, `80` ≈ 16.5k, `60` ≈ 28k — smaller granularity means more tiles, longer runtime, and higher credit cost.
- `date_time` uses `filter_type`: `1` = single hour (`start_time`), `2` = range of hours (`start_time`+`end_time`), `3` = single day (full 24 h), `4` = range of days (`end_date`, capped ~31 days). **Default to `filter_type=3`** for heatmap requests unless the feature dictates otherwise — one call yields both the daily peak and the full diurnal series for the risk engine.

### 9.3 Response shapes branch on `analytic_type`

The heatmap endpoint changes response shape depending on `analytic_type`:

- `tcm` (default): each tile's `properties` carries **either** a single `temperature` field (`filter_type` 1/2) **or** `average_temperature` / `min_temperature` / `max_temperature` (°C) (`filter_type` 3/4). `tcm` tiles **never** include per-hour `'00'..'23'` fields — no parser should expect an hourly dict on a `tcm` response. `stats_data` carries `temperature_stats` (min/max/mean/standard_deviation) plus distribution fields.
- `time_of_measure` / `exceedance` / `persistence`: each tile's `properties` carries `tile_id` + `value`, interpreted using `stats_data.units` (currently `"hour"`). `stats_data` carries `activity_id`, `analytic_type`, `units`, `n_cells`, `min`, `max`, `mean`.
- `exceedance` and `persistence` additionally require `threshold` (°C) and `direction` (`"above"` / `"below"`) in the request.

The backend normalizer must branch on `analytic_type`; it cannot assume a single flat heatmap shape.

### 9.4 Activity billing context

Failed tasks are **free**; credits are deducted only when a task reaches `Completed`. This is billing context and must not change error-handling behavior.

### 9.5 AOI sizing for route comparison (D2)

Route comparison uses **one shared hull** covering all compared routes in a single heatmap request:

- Do **not** request a separate heatmap per route.
- Do **not** hard-refuse a comparison just because the routes are far apart.
- Size the hull within the active plan cap (Basic 10 mi², Premium 50 mi²).

This keeps credit usage down and places every route on a common temperature scale.

### 9.6 Location search stays open (D3)

The location search/picker stays **open** — do not restrict autocomplete or
search to U.S.-only locations. When a FortyGuard request fails because the
location is outside coverage, surface a **lightweight, non-technical error
message** (never a raw API error). Out-of-coverage is a normal user-facing state,
not a crash.

---

## 10. FortyGuard API Documentation Rule

`docs/project/Aither_FortyGuard_API_Reference.md` is the primary project reference, and `docs/reference/temperature-api-quickstart` is the canonical contract reference (Python client + notebooks + cached responses).

When writing FortyGuard integration code:

1. Read the relevant section.
2. Match the documented request shape.
3. Match the documented response shape (branching on `analytic_type` for heatmaps).
4. Use the documented `activity_id`.
5. Poll through the documented status endpoint.
6. Do not invent fields.
7. Do not invent endpoint names.
8. Do not assume undocumented behavior.

If the required behavior is not documented:

> Stop and ask the user or explicitly state what is unknown.

Do not silently guess.

---

## 11. FortyGuard API Key

The API key belongs exclusively on the backend.

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

Never expose the FortyGuard key through:

```text
VITE_*
frontend source
client-side environment variables
browser localStorage
browser sessionStorage
query parameters
URLs
logs
```

Use:

```env
FORTYGUARD_API_KEY=...
FORTYGUARD_BASE_URL=https://api.fortyguard.com
```

Never commit secrets.

---

## 12. FortyGuard Asynchronous Workflow

Heatmap and environmental analysis are asynchronous.

Expected workflow:

```text
POST
  ↓
activity_id
  ↓
GET /v1/status/{activity_id}
  ↓
Processing
  ↓
poll
  ↓
Completed
  ↓
consume result
```

Do not assume the initial POST contains the final result.

Do not poll forever.

Centralize polling logic.

Do not duplicate activity polling in multiple services.

Billing context: failed tasks are free; credits are deducted only once a task reaches `Completed`. This does not change error-handling behavior — failed activities must still stop polling and surface an error.

Status strings are matched **case-insensitively** — lowercase the raw value before comparing:

```text
Terminal success: completed OR succeeded
Terminal failure: failed OR error
Anything else (e.g. Processing, unknown strings) → keep polling
```

Reference poll defaults (from the vendored client): `poll_interval` = 3 s,
`timeout` = 600 s (the out-of-scope `heat_intelligence` endpoint uses 5 s / 900 s).
Shortly after submission the status endpoint can briefly return 404 while the
activity propagates; treat that as retryable, not as a failure.

---

## 13. FortyGuard Null Handling

FortyGuard may return:

```json
null
```

for unavailable numeric environmental values.

Treat:

```text
null
```

as:

```text
unknown / unavailable
```

Never:

```text
null → 0
```

Never fabricate a replacement value.

### 13.1 env_params quirks

- `heat_index_celsius` is a **humidity-driven curve at the supplied fixed `temperature` anchor**, not a diurnal forecast — it can peak around 2 a.m. while real air temperature is at its minimum. Use `apparent_temperature_celsius` for time-of-day comparisons.
- `env_params` resolves on a **weather grid coarser than the heatmap layer**; it cannot discriminate between nearby locations. Use the heatmap layers for site-to-site comparison.

---

## 14. Routing Architecture

FortyGuard provides the heat intelligence.

A separate routing provider provides route geometry.

Architecture:

```text
Routing Provider
    ↓
Route Geometry

FortyGuard
    ↓
Heat Data

Aither
    ↓
Spatial / segment analysis
    ↓
Heat exposure
    ↓
Route comparison
    ↓
Recommendation
```

Do not pretend FortyGuard is the routing provider.

Do not mix routing-provider contracts into the FortyGuard client.

---

## 15. Heat Risk Engine

Heat risk should be deterministic and explainable.

The initial model uses a weighted-sum structure with **both** of these as
first-class inputs (D1):

```text
temperature severity
threshold exceedance
persistence
```

Both the peak-temperature term and the exceedance/persistence terms must feed the
score — neither is auxiliary. (Why: the reference's own "parcel scale vs. city
scale" finding shows the daily-peak snapshot is nearly flat below city scale while
hours-above-threshold still separates sites.) Fixed numeric weights are
provisional project parameters, not a license to let temperature dominate.

Optional environmental inputs:

```text
heat index
apparent temperature
humidity
wet-bulb temperature
```

Do not use an LLM to calculate the numeric risk.

Do not call a heuristic "scientifically validated" unless the project actually has validation supporting that claim.

If weights or thresholds are product-defined, label them as project parameters.

---

## 16. Route Scoring

Route comparison should consider:

```text
heat exposure
travel time
distance
```

Do not automatically choose the longest route because it has a lower temperature.

The product should expose the tradeoff.

Example:

```text
FASTEST
2.3 km
31 min
HIGH heat exposure

RECOMMENDED
2.6 km
35 min
LOW heat exposure

+4 min
-38% estimated heat exposure
```

The percentage must come from actual calculated data.

Never hard-code impressive numbers only for the demo.

---

## 17. Forecast Rules

**There is no forecasting anywhere in the product (D4).** The canonical contract
supports dates **2021-01-01 to today** only — it cannot return future or forecast
temperatures, so the product must not claim any.

- The departure-time picker allows **past hours of the current day only** — never future times.
- Remove any "12-hour forecast" or future-forecast framing from UI copy, docs, and demos.
- Any request that would land on an unsupported or future time must be blocked at the picker or fail gracefully with a plain-language explanation.

Do not build a custom forecasting model unless explicitly requested.

Aither uses FortyGuard's temperature intelligence; it does not replace it.

---

## 18. Backend Architecture

Prefer a simple modular Node.js backend.

Suggested structure:

```text
src/
├── routes/
├── services/
│   ├── fortyguard/
│   ├── routing/
│   ├── heat/
│   └── risk/
├── types/
├── utils/
└── server.ts
```

Keep responsibilities clear:

```text
routes
    ↓
application services
    ↓
external clients / domain logic
```

Do not put business logic directly inside HTTP route handlers.

---

## 19. FortyGuard Client Boundary

All direct FortyGuard HTTP requests should live behind the FortyGuard client/service.

Preferred:

```text
services/fortyguard/
├── client.ts
├── heatmap.ts
├── envParams.ts
├── status.ts
└── types.ts
```

Other application modules should not contain raw:

```ts
fetch("https://api.fortyguard.com/...")
```

calls.

This keeps external API details localized.

---

## 20. Frontend Stack

Use:

```text
React
TypeScript
Vite
```

For frontend code:

- TypeScript only.
- Avoid JavaScript files for new frontend modules.
- Prefer functional components.
- Prefer explicit types.
- Avoid `any`.
- Keep components focused.
- Keep business logic out of presentation components when it becomes non-trivial.

---

## 21. TypeScript Rules

Prefer:

```ts
type HeatRisk = "low" | "moderate" | "high" | "critical";
```

over:

```ts
const risk: any = ...
```

Avoid `any` unless there is a genuinely unavoidable external boundary, and isolate it there.

Prefer discriminated unions for stateful APIs:

```ts
type ActivityState =
  | { status: "processing" }
  | { status: "completed"; result: HeatmapResult }
  | { status: "failed"; error: string };
```

Keep shared API/domain types explicit.

Do not duplicate the same type in multiple modules.

---

## 22. React Component Rules

Components should have one clear responsibility.

Good:

```text
HeatMap
HeatRiskPanel
RoutePlanner
RouteComparison
LocationSearch
```

Avoid giant components containing:

```text
map logic
API calls
routing logic
risk calculations
UI
```

all in one file.

Extract logic only when the extraction improves clarity.

Do not create hooks for trivial one-line operations.

---

## 23. State Management

Do not install a state-management library by default.

Use:

```text
React state
context when actually necessary
server-state abstraction when actually necessary
```

Only introduce a dedicated state library if the application genuinely needs it.

Do not add Redux/Zustand/etc. just because they are common.

---

## 24. API Client Rules

The frontend communicates with Aither's backend.

Example:

```text
Frontend
    ↓
/api/heatmap
/api/risk
/api/routes/analyze
```

The frontend should not know:

```text
FortyGuard activity IDs
FortyGuard polling
FortyGuard API key
FortyGuard raw request structure
```

The backend owns external API integration.

---

## 25. Error Handling

Handle at minimum:

```text
invalid input
network failure
FortyGuard failure
activity failure
activity timeout
routing failure
missing heat data
missing environmental data
invalid coordinates
```

Do not silently swallow errors.

Bad:

```ts
try {
  await doSomething();
} catch {}
```

Good:

```ts
catch (error) {
  logger.error(error);
  throw new ServiceError("Heatmap generation failed");
}
```

Do not expose secrets or raw infrastructure details in user-facing errors.

---

## 26. Loading States

Async UI must have clear states.

At minimum:

```text
idle
loading
success
error
```

For long-running heatmap generation:

```text
Preparing heatmap...
Analyzing temperature...
Rendering heat data...
```

Do not make the UI appear frozen while the backend polls.

---

## 27. UX Rules

Aither should feel like a professional climate-intelligence product.

Visual priorities:

```text
Map
    ↓
Heat information
    ↓
Route comparison
    ↓
Recommendation
```

Do not turn the interface into a generic dashboard full of cards.

The map should remain the primary visual element.

---

## 28. Product Language

Use clear language.

Prefer:

```text
Heat exposure
Heat risk
Recommended route
Estimated exposure
Trip-time conditions
Temperature
```

Avoid vague AI-style language such as:

```text
AI-powered intelligence engine
Next-generation autonomous climate reasoning
```

unless there is an actual feature supporting the claim.

---

## 29. Demo Integrity

Never fake API data in the production/demo path.

Do not hard-code:

```text
42% lower heat exposure
43.2°C
31 minutes
```

just to make the demo look better.

If mock data is necessary during early development:

```text
explicitly mark it as mock
keep it isolated
make replacement easy
```

Before the final demo, use real FortyGuard responses.

**The demo runs live FortyGuard calls only** — no cached/replay response strategy
(no `CACHED`/`REFRESH`-style responses). Treat Aither like a live maps product:
real-time calls with standard loading and error states.

---

## 30. No Premature Optimization

Do not optimize before there is evidence of a problem.

Do not introduce:

```text
Redis
queues
workers
complex caching
database replication
microservices
```

for a hackathon MVP.

If caching is useful, start with the simplest appropriate mechanism.

---

## 31. Caching

Heatmap requests can be expensive.

If caching is needed, prefer a deterministic cache key based on request parameters.

Conceptually:

```text
hash(
  polygon
  +
  date
  +
  time
  +
  granularity
  +
  analysis
)
```

Do not add distributed caching infrastructure unless required.

Do not cache data beyond its meaningful validity period without understanding API behavior.

---

## 32. Security

Never commit:

```text
.env
API keys
tokens
credentials
private URLs
```

Avoid logging:

```text
Authorization headers
API keys
full external request headers
sensitive environment variables
```

Validate user-controlled:

```text
coordinates
polygon data
dates
times
route parameters
```

---

## 33. Dependencies

Before installing a dependency, ask:

1. Is it actually necessary?
2. Can the existing stack solve the problem cleanly?
3. Is it maintained?
4. Does it significantly increase project complexity?

Do not install a package for a trivial utility.

Do not add multiple libraries solving the same problem.

---

## 34. Refactoring Rules

Refactor when:

```text
duplication is meaningful
a module has multiple responsibilities
a dependency boundary is unclear
a bug is caused by architecture
```

Do not refactor merely because code is not written in your preferred style.

Do not rewrite working code during an unrelated feature.

---

## 35. Comments

Code should explain itself through naming and structure.

Do not add comments like:

```ts
// increment i
i++;
```

Useful comments explain:

```text
why
```

not:

```text
what
```

Example:

```ts
// FortyGuard activities are asynchronous, so the result cannot
// be consumed from the initial submission response.
```

Keep comments concise.

---

## 36. Naming

Use descriptive names.

Good:

```text
createHeatmap
waitForActivity
calculateRouteExposure
getEnvironmentalParameters
```

Bad:

```text
doThing
processData
handleStuff
temp
x
```

Use consistent terminology:

```text
heatmap
heat exposure
heat risk
route
segment
activity
trip-time conditions
```

Do not randomly alternate between similar names unless they represent genuinely different concepts.

---

## 37. File Organization

Prefer feature-oriented organization where useful.

Example:

```text
features/
├── heatmap/
├── risk/
└── routing/
```

Do not create a `utils` folder containing half the application.

A utility should be genuinely generic.

---

## 38. Testing

Testing should focus on deterministic business logic.

Highest-value tests:

```text
risk classification
route exposure calculation
route comparison
normalization of FortyGuard responses
activity state handling
null handling
```

Do not create dozens of tests for trivial React markup.

Do not add a testing framework solely because "every project needs tests" if the repository does not already have one and the user did not request it.

If tests already exist, preserve them.

---

## 39. Debugging Restrictions

Do not perform unnecessary debugging workflows.

Do not:

- generate random temporary scripts
- create disposable files throughout the repository
- add debug prints everywhere
- add permanent debug logging to production code
- launch unrelated services
- run destructive commands
- reset or delete project state
- replace configuration blindly

When debugging:

```text
reproduce
→ inspect
→ identify cause
→ make minimal fix
→ verify
```

Do not guess-and-rewrite.

---

## 40. Validation

Before declaring a task complete:

1. Inspect the changed code.
2. Check types.
3. Run the smallest relevant validation available.
4. Check for obvious integration errors.
5. Confirm the requested behavior is actually implemented.
6. Report what changed.

Do not claim:

```text
"tested successfully"
```

unless the relevant validation was actually run.

---

## 41. Do Not Hide Failures

If validation fails:

```text
say what failed
say where it failed
say whether the failure is caused by the change
```

Do not silently ignore errors.

Do not modify unrelated code simply to make a validation command pass.

---

## 42. No Unnecessary Environment Changes

Do not change:

```text
Node version
package manager
TypeScript configuration
Vite configuration
ESLint configuration
deployment configuration
environment variables
```

unless the requested feature requires it.

If a configuration change is necessary, keep it minimal and explain why.

---

## 43. Git Rules

Do not:

```text
git reset --hard
git clean -fd
delete untracked user work
force-push
rewrite history
```

unless explicitly instructed.

Do not commit changes unless the user explicitly asks for a commit.

Do not modify unrelated files simply to make the working tree look clean.

---

## 44. Existing User Work

Treat existing project code as intentional until proven otherwise.

Before deleting or replacing something, determine:

```text
Why does it exist?
Who uses it?
Is it part of another feature?
```

Never delete a component, service, type, asset, or configuration merely because it appears unused at first glance.

---

## 45. Working With Documentation

When documentation exists:

```text
read it first
```

Do not infer an API from memory when the repository contains documentation.

Do not replace project terminology with generic terminology.

When adding implementation-specific documentation:

```text
document actual behavior
```

not desired future behavior.

---

## 46. Agent Communication

Progress updates should be concise and factual.

Good:

```text
Implemented the FortyGuard heatmap adapter and centralized activity polling.

Changed:
- services/fortyguard/heatmap.ts
- services/fortyguard/status.ts
- types/fortyguard.ts
```

At completion, provide:

```text
What changed
Files changed
Validation performed
Known limitations
```

Avoid long explanations before every small change.

---

## 47. When to Ask the User

Ask before proceeding when:

- the requirement is genuinely ambiguous
- two interpretations produce materially different products
- an external API behavior is undocumented
- a destructive operation is required
- a major architecture change is required
- credentials/access are required and unavailable
- the requested feature conflicts with project scope

Do not ask for confirmation for routine implementation decisions that can be made safely within these rules.

---

## 48. Better Approach Rule

If you see a clearly better implementation, do not silently substitute it.

Use:

```text
Current requested approach:
...

Potential improvement:
...

Impact:
...

Recommendation:
...
```

Then proceed with the requested approach unless the user asks for the improvement.

If the requested implementation is technically impossible or violates an explicit project constraint, explain the blocker and propose the smallest viable alternative.

---

## 49. Scope Control

Keep a clear distinction between:

```text
MVP
Enhancement
Future
```

### MVP

```text
Heatmap
Risk Analysis
Route Comparison
Heat Exposure
Trip-time heat evaluation
```

### Enhancement

```text
Environmental parameters
AI explanations
advanced visualizations
better caching
```

### Future

```text
Satellite segmentation
Street View segmentation
Heat Intelligence
enterprise fleet management
accounts
notifications
```

Do not pull Future features into MVP without explicit approval.

---

## 50. AI Feature Rules

If AI is added:

The LLM receives structured facts.

Example:

```json
{
  "risk": "high",
  "temperature": 39.4,
  "peakTemperature": 43.1,
  "routeDurationMinutes": 35,
  "heatExposureReductionPercent": 38
}
```

The LLM can produce:

```text
The recommended route takes approximately four minutes
longer but has substantially lower estimated heat exposure.
```

The LLM must not:

- invent numbers
- alter scores
- fabricate API responses
- select coordinates
- replace deterministic calculations
- become an autonomous routing agent

---

## 51. Data Flow Rule

Prefer explicit data flow:

```text
External API
    ↓
Adapter
    ↓
Normalized Type
    ↓
Domain Logic
    ↓
Application Service
    ↓
HTTP Response
    ↓
Frontend
```

Avoid:

```text
API response
    ↓
directly into 12 React components
```

Normalize external data once at the boundary.

---

## 52. External API Types

FortyGuard response types should be separated from Aither domain types when their shapes differ.

Example:

```ts
type FortyGuardHeatmapResult = {
  map_data: unknown;
  stats_data: unknown;
};
```

Then normalize into:

```ts
type HeatmapResult = {
  map: GeoJSON.FeatureCollection;
  statistics: HeatStatistics;
};
```

Do not spread FortyGuard-specific naming throughout the entire application.

The external API belongs at the boundary.

---

## 53. Coordinate Rules

Aither must consistently distinguish:

```text
latitude
longitude
```

GeoJSON uses:

```text
[longitude, latitude]
```

A coordinate object should preferably use explicit names:

```ts
type Coordinates = {
  latitude: number;
  longitude: number;
};
```

Do not use ambiguous:

```ts
[number, number]
```

throughout the application unless the order is explicitly documented by the type.

---

## 54. Date and Time Rules

Do not silently mix:

```text
local time
UTC
FortyGuard timezone
browser timezone
```

When working with external temperature data:

- preserve the requested time
- preserve timezone metadata when available
- do not silently shift timestamps
- do not display UTC as local time without conversion

If timezone behavior is unclear, inspect the API response and document the chosen behavior.

---

## 55. Product Claims

Do not make unsupported claims such as:

```text
"safe route"
"guaranteed protection"
"medical-grade heat prediction"
"scientifically proven risk score"
```

Prefer:

```text
lower estimated heat exposure
higher estimated heat risk
recommended based on heat exposure
```

Aither provides decision support, not a guarantee of safety.

---

## 56. Map Performance

Do not render unnecessarily large datasets directly into React state if the map library can handle them more efficiently.

Avoid repeatedly transforming the same GeoJSON on every render.

Prefer:

```text
fetch once
normalize once
memoize derived visualization data when necessary
```

Do not optimize prematurely.

Measure first when performance becomes an issue.

---

## 57. Logging

Use structured, useful logs.

Good:

```text
Heatmap activity submitted
activityId=...
```

Avoid:

```text
HERE IS EVERYTHING
{ entire request }
{ API key }
{ entire environment }
```

Never log API keys.

Do not leave noisy debug logs in production code.

---

## 58. Temporary Code

Temporary code must be clearly isolated.

Do not leave:

```text
test-route-final-final.ts
debug2.ts
temp.ts
newtest.ts
```

in the repository.

If a temporary script is required, remove it when finished unless it becomes an intentional development tool.

---

## 59. Dependency and API Failures

If FortyGuard is unavailable, the application should fail gracefully.

Example:

```text
Heat data is temporarily unavailable.
Please try again.
```

Do not fabricate fallback heat data in the production path.

If mock fallback is intentionally implemented for development, keep it explicitly behind development configuration.

---

## 60. Final Completion Checklist

Before saying a task is complete:

```text
[ ] Requirement implemented
[ ] Existing code inspected
[ ] No unrelated files changed
[ ] TypeScript types are correct
[ ] No unnecessary dependencies added
[ ] FortyGuard contract respected
[ ] API key remains backend-only
[ ] Async activities are handled correctly
[ ] null values are handled correctly
[ ] Errors are handled
[ ] Loading states are handled
[ ] No fake production data
[ ] No unnecessary architecture added
[ ] Relevant validation performed
[ ] Known limitations reported
```

---

# Aither Engineering North Star

```text
             FORTYGUARD
                  │
                  ▼
          Hyperlocal Heat Data
                  │
                  ▼
          ┌───────────────┐
          │ AITHER ENGINE │
          └───────┬───────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   Heat Risk           Route Heat
        │                   │
        └─────────┬─────────┘
                  ▼
             Recommendation
                  │
                  ▼
        "Find the cooler way."
```

Build this well.

Do not build around it.
