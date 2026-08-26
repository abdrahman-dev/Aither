# Aither — Development Phase 4: Landing Page, Layout Rebalance & Basemap Switch

> **Status:** Complete (static verification; see §6)
> **Date:** 2026-08-26

---

## 1. Overview

Phase 4 is the presentation-layer pass that turns the Phase 3.A tool into a
product with a front door:

- a dedicated **landing page** introducing Aither before the tool opens,
- a **structural layout rebalance** replacing the floating panel overlay with a
  first-class planning column beside the map,
- a **basemap switch** from hand-built raw OSM raster tiles to the keyless
  **CARTO Voyager** vector style,
- a **visual polish round** on the planner panels (brand header, SVG field-label
  icons, gradient accent bars, recessed date/time well, step-completion pop).

No backend, API-contract, or shared-type changes were made in this phase —
`@aither/shared`, `apps/api`, and every wire schema are untouched. The full
diff surface is four modified frontend files plus two new frontend paths.

### Naming note

The work planned at the end of Phase 3.A as "**Phase 3.B** — map-style
simplification and layout rebalancing" grew to include the landing page and was
referred to as "**Phase 3.C**" in earlier working context. It is recorded here
as **Phase 4** going forward. This numbering is part of the actual-progress
series (`docs/project/phases/`) and is **not** the original plan-numbering
"Phase 4 — Risk Engine" in `Aither_Project_Documentation.md` §32; the risk
engine itself already shipped inside Phase 2 (`services/risk/`). Earlier phase
records are preserved as written.

---

## 2. Files Added / Changed

```text
apps/web/src/features/landing/LandingPage.tsx      (new — entry page: hero, illustration, how-it-works)
apps/web/src/assets/AitherLogo.png                 (new — brand logo, rendered by planner + landing)
apps/web/src/App.tsx                               (changed — landing/app view switch; overlay → structural column)
apps/web/src/map/BaseMap.tsx                       (changed — OSM raster style removed; CARTO Voyager + expanded attribution)
apps/web/src/features/routing/RoutePlanner.tsx     (changed — brand headers, field icons, accent bars, polish)
apps/web/src/index.css                             (changed — .aither-step-pop keyframes/class)
```

Dependencies: none added or removed (icons are hand-drawn inline SVG; AGENTS.md
§33).

---

## 3. What Was Built

### 3.1 Landing page

- `App` now owns a `"landing" | "app"` view state and renders `LandingPage`
  first; the hero CTA ("Compare routes now") switches into the tool. Trip
  planning state is unaffected by the switch — `useTripPlanning()` is
  instantiated in `App` above the early return, so picking points, results, and
  geolocation survive landing↔app transitions.
- Hero: logo chip, gradient wordmark, headline *"Find the cooler way."*, the
  measured-data tagline, and the primary gradient CTA (§2.3 tokens throughout).
- `HeroRouteIllustration`: an aria-hidden SVG echoing the app's own rendering —
  schematic street grid, a Red-600 hot route vs a brand-gradient cooler route
  with glow, HIGH/LOW chips reusing the §2.4 badge pairs, and A/B pins matching
  the BaseMap markers. Qualitative chips only — **no invented numbers** (§29).
- "How it works": four-step timeline inside a glass panel (pick route → choose
  mode/time → real-data comparison → go the cooler way), ending with a quiet
  closing note restating that every number is measured, never a forecast (D4).

### 3.2 Structural layout rebalance

- The floating overlay column (`absolute left-4 top-4 … max-w-sm`) is gone.
  `App` renders a flex row: a fixed-width scrollable `<aside>` (420 px, bordered,
  `bg-map-base`) holding `RoutePlanner` + `ResultsCard`, and a `<main>` giving
  `BaseMap` the entire remaining viewport.
- Rationale (recorded in the `App.tsx` comment): neither region feels secondary
  on desktop, cards keep their glass styling on the shared app background, and
  the fixed-width flex row can later collapse to an overlay/bottom sheet on
  mobile without a rewrite. The map remains the primary visual element (§27) —
  it now owns more space than before, not less.

### 3.3 Basemap switch: raw OSM raster → CARTO Voyager

- `buildStyle()` (hand-rolled v8 style over `tile.openstreetmap.org` raster
  tiles) and its `StyleSpecification` import are removed. `BaseMap` now loads
  `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`.
- Why Voyager: the raw OSM raster was visually loud next to Aither's palette,
  while an intermediate Positron pass overshot into "featureless" — street
  names, water/park contrast, and landmark cues vanished. Voyager keeps a calm
  label hierarchy and subtle landcover color-coding while staying muted enough
  that brand markers and risk-tier route lines lead the screen (§27). (Only the
  final Voyager state is in the tree; Positron exists solely as context in a
  code comment.)
- CARTO's free tier requires visible attribution: the map now sets
  `attributionControl: { compact: false }` so "© CARTO, © OpenStreetMap
  contributors" renders expanded instead of hidden behind the ⓘ button.
- This adds a runtime dependency on CARTO's hosted style URL. It is keyless and
  free, consistent with the demo-runs-live stance (no caching/replay layer was
  added around it).

### 3.4 Planner panel polish

- **Brand headers**: both planner states (expanded form and collapsed "Trip
  ready" summary) open with the logo + gradient-clipped "Aither" wordmark;
  panels gain `relative overflow-hidden` and a thin `panelTopBar`
  brand-gradient accent strip along their top edge.
- **Field-label icons**: a tiny presentational `Icon` (inline SVG, stroke
  vocabulary, `currentColor`) plus a `FieldLabel` wrapper (renders a real
  `<label htmlFor>` when one applies, otherwise a styled `<span>`) put a
  colored icon next to each field — origin pin (brand sky), destination flag
  (emerald), route glyph, calendar, clock. No icon library was added.
- **Step strip**: completed step circles pop with the new `.aither-step-pop`;
  connectors thicken to 2 px, become pill-rounded, and light up with the brand
  gradient instead of flat emerald.
- **Recessed "When" well**: the date/from/to inputs moved into a
  `bg-map-base/70` well inside the glass panel (glass → map-base → surface =
  layered depth), separated from the other groups by hairline dividers.
- Smaller touches: point-picker buttons gained `shadow-top-bar` and a hover
  elevation shift; inputs gained `transition-colors` + soft hover borders;
  unselected mode radios hover on `map-base`; submit spacing bumped.

---

## 4. Key Technical Decisions

- **Marker-animation rule extended, not broken**: `.aither-step-pop` animates
  the individual `scale:` property (never `transform`), honoring the Phase 3.A
  root-cause rule that MapLibre positions marker carriers purely via inline
  `transform`. The CSS carries the same warning comment as `.aither-marker-drop`.
- **One shared `panelTopBar` ReactNode** is reused by the expanded and collapsed
  planner branches — safe because only one mounts at a time (documented inline).
- **Landing is a view, not a route**: no router dependency was added for one
  gate (AGENTS.md §7/§33); plain state keeps the bundle and architecture small.
- **Attribution compliance is treated as part of the integration**, not
  cosmetics — compact attribution was deliberately avoided.

---

## 5. Final Review Pass (this checkpoint)

A full static audit of the phase diff (4 modified + 2 new files) against HEAD
(`bdec691`, Phase 3.A) plus docs review. Per AGENTS.md §6.1 no dev servers or
browsers were launched.

### Fixed in this pass

- Nothing required fixing: the audit found **no critical issues** — no broken
  references to the removed `buildStyle()`/raster style, no dangling imports,
  no type errors, no contract or data-flow changes to verify against the
  backend.

### Reviewed and confirmed clean

- All Tailwind classes introduced resolve to tokens in `tailwind.config.js`
  (verified against `UIUX_Design_Guidelines.md` §2–§3); `.aither-step-pop` is
  defined in `index.css`.
- The `logoUrl` import resolves through Vite's asset pipeline with
  `vite/client` types; the asset builds and emits correctly.
- Planning-state lifecycle across the landing/app switch is correct (hook lives
  in `App`, above the early return).
- D4 messaging intact on the landing page and planner; no forecast framing, no
  fabricated numbers anywhere in the new UI.
- Backend, shared contracts, and caches untouched — zero API-surface drift.

### Flagged (not changed — copy/product decisions for a later pass)

- **Landing closing copy** claims data comes from "FortyGuard satellite
  sensors". Project docs establish only "measured temperature data /
  temperature intelligence"; the sensing modality is not documented anywhere in
  the contract materials. Mildly in tension with the product-language rules
  (AGENTS.md §28/§55); consider dropping "satellite".
- **No responsive collapse yet**: the 420 px planning column is desktop-first;
  the mobile overlay/bottom-sheet step is acknowledged in `App.tsx` as future
  work.
- **Bundle weight**: the >500 kB chunk warning from Phase 3.A persists, and the
  new `AitherLogo.png` (~486 kB uncompressed) is emitted as-is — compression or
  a smaller export is an easy polish win alongside the deferred code-splitting.
- **Success-path console logging** of the full `/api/route-risk` payload
  (carried over from Phase 3.A) remains intentional during live testing.
- There is no way back to the landing page once the tool is entered (one-way
  gate; harmless, but a "home" affordance may be wanted eventually).

---

## 6. Verification

- `npm run typecheck` — passes for all three workspaces
  (`@aither/shared`, `@aither/api`, `@aither/web`).
- `npm run build` — passes for all three workspaces; the logo emits as
  `dist/assets/AitherLogo-*.png`; only the known chunk-size warning appears.
- Static read-through of every changed/new file (this document's basis).
- **Not verified automatically**: in-browser behavior of the landing page,
  layout, and Voyager basemap (network fetch of the style, attribution render).
  Per AGENTS.md §6.1 this is left to the user: run `npm run dev:web` and check
  that the landing page opens, the CTA enters the planner, the map loads with
  CARTO attribution visible, and markers/routes still position correctly.

---

## 7. Current State After Phase 4

- The committed baseline remains Phase 3.A; **the Phase 4 changes sit uncommitted
  in the working tree** (committing/pushing is the user's call, AGENTS.md §43).
- Feature status: route-planning flow complete and polished behind a landing
  gate; standalone heatmap-exploration UI (`features/heatmap`) and location
  risk panel (`features/risk`) remain unbuilt placeholders; env_params service
  still implemented backend-side without an exposing route.
- Natural candidates for the next pass: mobile layout collapse, bundle/logo
  weight trim, landing-copy tightening, and the heatmap/risk exploration half
  of the original MVP definition.

---

## 8. Phase 4 Checklist

- [x] Landing page with hero, schematic route illustration, how-it-works timeline
- [x] Landing/app view switch preserving trip-planning state
- [x] Floating overlay replaced by structural planning column beside the map
- [x] Raw OSM raster style removed; CARTO Voyager vector basemap adopted
- [x] CARTO attribution rendered expanded (free-tier requirement)
- [x] Planner brand headers + gradient accent strips on both panel states
- [x] Inline-SVG field labels (no new dependencies)
- [x] Transform-safe `.aither-step-pop` completion animation
- [x] Recessed date/time well + section dividers + hover polish
- [x] Static audit found no critical issues; typecheck + build pass (all three workspaces)
- [x] Phase 4 checkpoint documented; stale progress notes in project docs annotated
