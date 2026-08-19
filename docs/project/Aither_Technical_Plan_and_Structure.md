# Aither — Technical Plan & Architecture

> **Technical Plan and Project Structure**
>
> This document outlines the technology stack and file structure for the Aither project.
> The plan is designed with flexibility in mind to accommodate future feature changes without being restricted to strict phases.

---

## 1. Technology Stack

The project relies on a modern stack that separates the frontend from the backend to ensure security and scalability.

### 1.1 Frontend
- **Core Framework:** React.js
- **Language:** TypeScript (for type safety and reducing runtime errors)
- **Bundler:** Vite (for fast development and building)
- **Mapping:** Libraries like Mapbox GL JS or Leaflet (to render GeoJSON heatmaps)
- **State Management:** Zustand or React Context (depending on complexity)
- **Styling:** Tailwind CSS (for rapid, clean, and modern UI development)

### 1.2 Backend
- **Runtime Environment:** Node.js
- **Core Framework:** Express.js (or Fastify)
- **Language:** TypeScript
- **External Services Communication:** Axios or Fetch API (to connect with FortyGuard and external routing providers)
- **Environment Management:** dotenv (to protect API Keys)

---

## 2. Project Structure

A Monorepo system (separate folders within a single repository) will be used to cleanly separate the frontend and backend, while centralizing shared code.

```text
aither/
├── .env.example                # Example environment variables (no real keys)
├── package.json                # Root configuration
├── README.md                   # Project description and run instructions
│
├── docs/                       # Documentation files
│   ├── Aither_Project_Documentation.md
│   ├── Aither_FortyGuard_API_Reference.md
│   ├── Aither_Technical_Plan_and_Structure.md
│   └── reference/temperature-api-quickstart   # Vendored official FortyGuard reference (read-only)
│
├── apps/                       # Main applications
│   │
│   ├── web/                    # 🌐 Frontend (React + Vite)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── main.tsx        # Application entry point
│   │   │   ├── App.tsx         # Main component
│   │   │   ├── api/            # API client for our own backend (not FortyGuard directly)
│   │   │   ├── components/     # Reusable UI components (buttons, text, etc.)
│   │   │   ├── features/       # Feature-based modules (easy to update/remove)
│   │   │   │   ├── heatmap/    # Heatmap rendering logic
│   │   │   │   ├── risk/       # Risk index dashboard
│   │   │   │   └── routing/    # Route selection and display
│   │   │   ├── map/            # Map configurations and base layers
│   │   │   └── types/          # TypeScript definitions
│   │
│   └── api/                    # ⚙️ Backend (Node.js)
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── server.ts       # Server entry point
│       │   ├── routes/         # API routes (Endpoints)
│       │   │   ├── heatmap.ts
│       │   │   ├── risk.ts
│       │   │   └── routes.ts
│       │   ├── services/       # Core business logic
│       │   │   ├── fortyguard/ # FortyGuard integration (Client, Polling)
│       │   │   ├── routing/    # External routing service integration
│       │   │   ├── heat/       # Heat data processing
│       │   │   └── risk/       # Risk calculation engine
│       │   ├── utils/          # Helper functions (e.g., Polling utility)
│       │   └── types/          # TypeScript definitions
│
└── packages/                   # Shared packages (optional / adds flexibility)
    └── shared/                 # Shared types/data between Frontend and Backend
        ├── package.json
        └── src/
            └── index.ts
```

---

## 3. Workflow & Flexibility Rules

Since the project will not be divided into strict phases to allow freedom for future feature changes, we will adhere to the following principles:

1. **Security and Logical Isolation:** 
   - `FORTYGUARD_API_KEY` is never exposed to the frontend. All requests go through the backend's `/api/` routes.
   - The frontend is unaware of how FortyGuard operates (e.g., it does not handle polling). It simply requests processed data from the backend.
2. **Feature-Driven Development:** 
   - The `features/` directory structure allows building or removing any feature (e.g., adding an AI module or changing risk logic) without breaking the rest of the application.
3. **Modular Design:** 
   - The routing service is isolated from the FortyGuard service. Route paths and thermal data are merged inside the Aither engine, allowing easy swapping of map or routing providers at any time.
4. **Data Over Assumptions:**
   - Strict reliance on data returned by FortyGuard. If any environmental variable is `null`, it is treated as unavailable, not as "zero".
5. **Normalization Branches on `analytic_type`:**
   - FortyGuard heatmap responses have two distinct shapes. `tcm` returns tile temperature fields — a single `temperature` for `filter_type` 1/2, or `average_temperature` / `min_temperature` / `max_temperature` for `filter_type` 3/4 (never per-hour `'00'..'23'` fields); `time_of_measure`, `exceedance`, and `persistence` return a single `value` per tile interpreted via `stats_data.units`, with `stats_data` carrying `activity_id`/`analytic_type`/`units`/`n_cells`/`min`/`max`/`mean`. The backend heat service must branch on `analytic_type` when normalizing; it must not assume one flat shape.
   - `env_params` responses are nested: `result.metadata` (`timezone`, `timezone_offset_hours`, `time_range`, `timestamps`) and `result.locations[]` (`lat`, `lon`, `elevation`, a `temperature` echo, a `parameters` map, and `solar_irradiance.clear_sky.{ghi,dni,dhi}` plus `description`). Parameter values are scalars for `filter_type=1` or arrays aligned with `metadata.timestamps` otherwise — the normalizer must read `locations[].parameters.<name>`, handling `null` entries per-sample as unavailable (never as 0).
   - See `reference/temperature-api-quickstart` and `Aither_FortyGuard_API_Reference.md`.
