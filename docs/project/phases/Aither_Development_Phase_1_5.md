# Aither — Development Phase 1.5: Credentials & Environment Checkpoint

> **Status:** Complete
> **Date:** 2026-08-19

---

## 1. Overview

FortyGuard API key and OpenRouteService (ORS) API key have both been obtained and
configured locally. This checkpoint marks the point where real external credentials
exist and Phase 1's foundation is validated end-to-end (both apps build cleanly),
but **no FortyGuard or ORS integration code has been written yet** — that begins
in the next implementation phase (Phase 2). The filename mirrors the interim
decimal precedent set by Phase 0.5 (an environment/credentials checkpoint between
Phase 1 foundation and Phase 2 integration), not a full implementation phase.

---

## 2. What Was Added

- **`FORTYGUARD_API_KEY`** — real key stored in the local root `.env` only, never
  committed and never exposed to the frontend.
- **`ORS_API_KEY`** — obtained from OpenRouteService's free **Standard tier**
  (2000 requests/day). A `ORS_API_KEY=` entry was added to the local root `.env`
  with an empty value; the real key is filled in manually before Phase 2
  implementation begins. Stored backend-only, never committed.
- **`.env.example`** — updated with the new `ORS_API_KEY` placeholder entry
  alongside the existing `FORTYGUARD_API_KEY`, `FORTYGUARD_BASE_URL`, `PORT`, and
  `VITE_API_BASE_URL` placeholders. No real values appear in `.env.example`.

---

## 3. Current Project State

Phase 1 (foundation) is complete: `apps/web` (Vite + React + TypeScript, Tailwind
design tokens per `UIUX_Design_Guidelines.md`, MapLibre base map, typed API client),
`apps/api` (Express + TypeScript, fail-fast env validation, `/api/health`, stub
`/api/heatmap`, `/api/route`, `/api/route-risk` routes, in-memory TTL cache utility,
D1 risk-formula signature), and `packages/shared` (coordinate + route-risk types)
are all scaffolded. Typecheck and `build` pass for all three workspaces. The
project therefore now has **both a working skeleton and live credentials** ready
for the Phase 2 implementation work.

---

## 4. Explicitly Out of Scope for This Checkpoint

- No FortyGuard client code (`services/fortyguard/` remains scaffold-only).
- No OpenRouteService client code (`services/routing/` remains scaffold-only).
- No heatmap, route, or risk logic implemented yet (routes return `501`
  "not implemented" placeholders).

These begin in the next implementation phase. This checkpoint was deliberately
limited to environment setup, documentation, and version control.

---

## 5. Phase 1.5 Checklist

- [x] FortyGuard API key obtained and added to local `.env`
- [x] ORS API key obtained (Standard tier, 2000 requests/day); `.env` entry added — real value pending manual fill-in before Phase 2
- [x] `.env.example` updated with `ORS_API_KEY` placeholder
- [x] Phase 1 foundation build-verified (frontend + backend + shared)
- [ ] FortyGuard client implementation (next)
- [ ] ORS client implementation (next)