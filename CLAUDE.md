# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node **24.14.x or 26.x** is required (`package.json` `engines` enforces this; `npm run doctor` checks it too).

```bash
npm run doctor        # Node/npm/dependency/provider-key readiness report (safe to run anytime)
npm run dev            # Vite dev server on http://localhost:4173, keyless by default
npm run build           # production bundle — must stay green before a PR
npm run preview          # serve the production build
npm test                 # unit tests (node:test, no framework) — must stay green before a PR
npm run test:track        # tracking-invariant regression checks; needs the dev server already running
npm run qa:map-source-tray # one of many scripts/qa-*.mjs Puppeteer black-box QA harnesses (see below)
./scripts/dev-fresh.sh      # macOS: clears Vite cache + pulls keys from Keychain, still keyless-capable
```

Run a single unit test file directly (bypasses the `run-unit-tests.mjs` wrapper, same underlying runner):
```bash
node --test src/mapStartup.test.mjs
```
Two files (`src/data/focusAllocations.test.mjs`, `src/overlays/worldOverlayAllocation.test.mjs`) are GC-bracketed allocation microbenchmarks; `npm test` runs them serially afterward with `--expose-gc --test-concurrency=1` and gates them to Node 24 (set `GEV_REQUIRE_ALLOCATION_GATE=1` to force on other majors).

`scripts/qa-*.mjs` (~40 scripts) are Puppeteer-driven, headless-Chromium black-box QA against a **running dev server** — distinct from and complementary to the unit tests. They assert real-app invariants that are hard to unit test (traffic mode fallback, CCTV raycast/calibration, voice routing, focus/horizon animation, etc.), screenshot to `qa-shots/`, and exit non-zero on failure. Run one standalone, e.g. `node scripts/qa-traffic.mjs --url http://localhost:4410`. CI (`.github/workflows/ci.yml`) only runs `npm run doctor -- --json`, `npm test`, and `npm run build` on Linux (Node 24.14.0 and 26.x) plus a Windows onboarding job (`pinokio-install.mjs` + a focused `node --test` subset + build) — the qa-*.mjs scripts are manual/local verification, not part of CI.

No API key is required to run the app (keyless Esri World Imagery + OSM fallback). Add keys via the in-app **POWER UP** panel (writes `.env` for a terminal checkout, or `pinokio/ENVIRONMENT` under Pinokio) rather than hand-editing `.env` — see `.env.example` for the full list and what each unlocks.

## Architecture

**No framework.** Vanilla JS + CesiumJS + Vite. Entry point `src/main.js`: builds the Cesium `Viewer`, loads Google Photorealistic 3D Tiles via `mapStartup.js` (falls back to keyless OSM), sets up `MapStackController` (imagery/terrain stack) and `StyleManager`, then a `DataLayerManager` registers each layer module from `src/data/*` (flights, militaryFlights, earthquakes, satellites, rocketLaunches, traffic, cctv, radio, bikeshare, aisLiveVessels, militaryInstallations, ...). `SceneDirector`, annotations, the render governor, scope mask, and voice commands are wired in last. Everything is exposed on `window.__godsEyeView` for console/QA-script access.

- **`src/data/<layer>.js`** — one self-contained module per data layer, implementing a common interface (`init/enable/disable/update/destroy/getStats`, optional `getDetectableObjects`). Use an existing layer as the template for a new one.
- **`src/ui.js`** — panels, HUD, styles, the control facade. Kept deliberately separate from layer logic.
- **`src/overlays/`** — world-space label/marker rendering shared across layers (distance/altitude fade, arbitration via `labelArbiter`).
- **`src/scenes/`** — `SceneDirector`, a deterministic camera/style/layer playback engine for recorded cinematic tours (persisted to localStorage).
- **`src/voice/`** — OpenAI Realtime voice-agent bridge (`gevRealtime.js`), client-side action dispatch (`gevActions.js`), cost tracking (`voiceCost.js`).
- **`src/annotations/`** — the voice-driven "whiteboard" drawing engine (hybrid world-space footprints + screen-space SVG callouts) behind one `index.js`.
- **`src/styles/`** — GLSL post-process visual styles (CRT, NVG, FLIR/thermal, Noir, Snow, ...).

**`vite.config.js` is ~7,800 lines by design** — it *is* the dev/prod server. Rather than a separate server file, it defines one Vite plugin per upstream data source (`openSkyProxy`, `celestrakProxy`, `tomtomProxy`, `firmsProxy`, `overpassProxy`, `aisLiveProxy`, `openAiRealtimeProxy`, `cctvProxy`, `radioBrowserProxy`, `keySetupEndpoint`, etc.), each registered via `configureServer(server) { server.middlewares.use('/api/x', handler) }` with its own cache (`.gev-cache/`), TTL, single-flight upstream coalescing, and stale-serves-over-empty fallback. **All secrets stay server-side**: any code needing a private key goes through a proxy here — the browser only ever sees the Google Maps key and Cesium ion token (both restrictable at the provider) plus ephemeral realtime tokens. Voice tool definitions (`GEV_REALTIME_TOOLS`) and their server-side actions (`fly_to_location`, `control_cctv`, `annotate_map`, ...) also live inline in this file, executed client-side in `src/voice/gevActions.js`. It imports parsing/normalization logic directly from `src/data/*.js` (e.g. `firmsCsv.js`, `tomtomTiles.js`, `aisStreamAdapter.js`) to share code between the server proxy and the client — a reason data modules stay side-effect-free/pure and dependency-injected rather than importing singletons.

**Testing style**: source modules take dependencies (e.g. `Cesium`) as parameters rather than importing them as singletons, so tests pass hand-built fake objects with call recording instead of a mocking framework. `renderGovernor.js` uses a ref-counted `Set` of string owner-ids (not a counter) for idempotent hold/release — preserve that pattern when extending it.

`docs/CURRENT-STATE.md` is the authoritative runtime reference — read it before changing runtime behavior, and update it (plus `CHANGELOG.md`) in the same PR as any behavior change. `docs/KNOWN-ISSUES.md` and `docs/PERFORMANCE.md` are also current-state docs, not historical.

## Conventions

- ES modules, 2-space indent, single quotes, semicolons. JSDoc on exported/public functions.
- Adding a data source: update [DATA_SOURCES.md](DATA_SOURCES.md) with its license/attribution. Never bundle data you don't have the right to redistribute — fetch it at runtime instead.
- Royal Navy ADM 173/199 archival research (submarine logs, war diaries): read [docs/adm-173-199-research-guide.md](docs/adm-173-199-research-guide.md) first — it's research-reference only (not wired into the app), and its ToS note explains why this source can never be bundled like `local_data/`.
- Adding a CCTV source pack: the proxy only fetches server-registered frame URLs, never client-supplied ones (see `SECURITY.md`) — follow the Austin pack (`config/cctv_sources.austin.json`) as the reference shape.
- Conventional-commit-style prefixes (`feat:`, `fix:`, `perf:`, `docs:`) are appreciated but not required.

## This fork: a 1939-1945-only build

Everything above describes upstream's present-day app. **This checkout shows only the Second
World War**, and it does so with one switch rather than by deleting code:

- **`src/period.js`** — `WW2_ONLY = true`. Read by: `main.js` (only `PERIOD_LAYER_IDS` register;
  `finalizeRegistrations` gets `filterRegistryForPeriod(LAYER_STATE_REGISTRY)`; the first-run
  launcher is skipped; the opening view is `flyToWarAtlas`, not Austin), `dataCredits.js`
  (`creditsForPeriod`), `keySetup.js` (`periodKeyStatus`: 3 keys, not 8), `ui.js` `setStyle`
  (`styleInPeriod`: only `normal` and `noir`), and `style.css` (an `html.period-ww2` block that
  hides CCTV, Context/Contacts/Radio, cockpit, detection and 3D-aircraft controls, the traffic
  and CCTV chips, and the retro/surveillance/thermal/anime/snow style buttons).
- The modern layer modules, proxies (`vite.config.js`), voice tools and ~2,700 tests stay on disk,
  dormant. Flip the flag to bring the layers back. **The HUD is the exception:** `hud.js` was
  rewritten in place (war-atlas banner, lat/lon and altitude only, no MGRS/GSD/NIIRS, no live
  clock, no remote summary); the original is at commit `7596522`.
- `LayerStateCoordinator._restoreSelectedState` skips layers that were never registered, so old
  share links naming modern layers restore only what exists.
- **Do not hide `#right-context-rail`.** At runtime `ui.js` moves the DISPLAY panel
  (`#pp-toggles`) into it beside CCTV and CONTEXT; hide those two individually.
- Known leftovers, deliberately not touched: the voice agent's tool schema and instructions still
  name modern layers (they no-op safely when the layer is absent); `loadingFeedback.js` still says
  "LIVE DATA"; `docs/CURRENT-STATE.md` and `DATA_SOURCES.md` still describe the dormant sources
  (each carries a note saying so); upstream's README is archived at `docs/UPSTREAM-README.md`.
- Adding a new period layer: add its id to `PERIOD_LAYER_IDS`, its credit key to
  `PERIOD_CREDIT_KEYS`, and follow the `local-ww2-naval` / `ww2-country-labels` wiring below.
  `src/period.test.mjs` pins every consumer of the gate, so a missed one fails a test.

### WW2 layers

This checkout adds two data layers beyond upstream `bilawalsidhu/gods-eye-view`
(tracked as git remote `upstream`, no `origin` configured — see git remote -v):

- **`src/data/ww2CountryLabels.js`** + **`src/data/local_data/ww2Countries/`** —
  `id: 'ww2-country-labels'`. Era-correct country/territory names for 1939-1945 as
  ambient labels through the shared world-overlay host (not a native Cesium label
  layer). The dataset (`labels.js`) is date-ranged label points; the layer's panel
  row shows five snapshot chips (Aug 1939, Jun 1941, Nov 1942, Jun 1944, May 1945)
  via the DataLayerManager row-controls contract (`getRowControls`, like
  satellites' DENSE chip). The chosen era is an option (`era`) in the share-link
  codec: `layerState.js` `OPTION_GROUPS['ww2-country-labels']` and registry token
  `l`, with its codes derived from `ERAS`, so adding an era needs no codec edit.
  `setParams` must work before `init`/`enable` because the state coordinator
  restores options first. `labels.js` is the only hand-edited data: keep periods
  sorted and non-overlapping, and add each new fact to the golden table in
  `ww2CountryLabels.test.mjs`. The folder `README.md` lists the editorial rules
  (effective control, not legal survival) and which facts were not confirmed
  against a fetched source. Voice: toggle target only (not in `get_entity_context`,
  the labels are not selectable).
- **`src/data/local_data/ww2Naval/`** — 25 major WW2 naval battles (1939-1945),
  bundled as a static `.geojsonl` snapshot via the same `createLocalGeoJsonLayer`
  pattern as the dams/datacenters layers. Registered in `src/data/localLayers.js`,
  `id: 'local-ww2-naval'`. See that folder's own `README.md` for sourcing,
  coordinate-precision notes, and deliberately out-of-scope follow-up work
  (front lines, convoy routes as lines, a time-scrubber UI).
- Touches shared files beyond the new layer: `src/data/layerState.js`
  (`LAYER_STATE_REGISTRY`, token `n`), `src/data/localGeojson.js` (card-copy
  branch), `src/data/dataCredits.js` + `DATA_SOURCES.md` (attribution),
  `src/voice/gevActions.js` + `vite.config.js` (voice-tool enums) — each of
  those files has its own "add a new layer here too" convention already
  documented inline; follow the `local-ww2-naval` additions as the template
  for a second historical layer.
- Two tests in this repo intentionally pin exact byte-lengths/hashes of
  generated schema text (`src/firstRunExperience.test.mjs`'s
  `GEV_REALTIME_TOOLS` pin, `src/radioMarkup.test.mjs`'s "unchanged tool"
  digest) specifically so a schema edit can't drift silently. Both were
  re-pinned for this layer — if you touch `vite.config.js`'s realtime tool
  enums again, re-derive both per their own in-test instructions.
