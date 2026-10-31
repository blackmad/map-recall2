# Lane brief: oracle migration 2 — specs and scripts off `vectorMap.map` (2026-10-31, #129)

**Model: haiku.** The work is mechanical, one pattern table, one file at a time.

**What you are doing.** Under `?engine=own` (the engine that becomes the default at P5) there is no MapLibre map:
`window.canalRecallGame.vectorMap.map` is `undefined`. 124 files (75 specs, 49 scripts) still read it.

- Move every camera or frame read onto an API that both engines answer.
- Leave the MapLibre-only style assertions alone, but skip them under `ENGINE=own`. They are deleted together
  with the default path at P5.
- The classification below was made by L1 (`docs/handoffs/flip-inventory-20261031.md`, §4) from the members each
  file calls.

## Setup

- **Worktree and branch:** use a fresh worktree and a branch `lane/oracle-migration-2-20261031`.
  - Link `node_modules` from the main checkout. Never run `npm install`.
  - Dev port **4561**; start it with `PORT=4561 nohup npm run dev > /tmp/dev-4561.log 2>&1 &`.
- **Git:** always use `/usr/bin/git`. Never `git stash`. Never `pkill`; stop the server with
  `kill $(lsof -t -iTCP:4561 -sTCP:LISTEN)`.
- **Browser runs:** one at a time, through `/tmp/canal-pw.sh`.
  - Always `PW_PORT=4561 … --workers=1 --trace off`.
  - Named specs only.
  - Delete `test-results/` after each run.
- **Do not edit:**
  - `game.js`, `vector-map.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`;
  - any file under `src/` (the engine API is L1's; if you need a camera member that is missing, list it in the
    hand-back);
  - any threshold, budget or golden.
- **Commits:** one commit per group of about 5 files. Each commit message lists the specs re-run and their
  result in both engines.

## Step 1 — add one helper (first commit)

Create `tests/e2e/worldCam.ts`. Its functions are passed into `page.evaluate`, so they must be self-contained;
copy them inline if Playwright refuses the closure. Until P5, the oracle camera is
`vm.map ?? vm.cameraMap`:

- the MapLibre map under the default engine;
- the engine's `CameraMap` under `own`, which answers the same `jumpTo`, `stop`, `setMaxPitch`,
  `setVerticalFieldOfView`, `setPadding`, `calculateCameraOptionsFromTo`, `getCanvas`, `triggerRepaint`,
  `getPixelRatio` and `setPixelRatio`.

```ts
// In-page: the camera both engines answer (MapLibre map, or the engine's CameraMap under ?engine=own).
export const OWN = process.env.ENGINE === 'own';
export function oracleCameraSource(): string {
  return `(() => { const vm = window.canalRecallGame.vectorMap; return vm.map ?? vm.cameraMap; })()`;
}
```

Inside `page.evaluate(() => { … })`, write
`const vm = (window as any).canalRecallGame.vectorMap; const map = vm.map ?? vm.cameraMap;`
in place of `const map = vm.map;`.

## Step 2 — the replacement per read pattern

| Read today | Replace with (works in both engines) | Notes |
|---|---|---|
| `vm.map.getCenter()` / `getZoom()` / `getPitch()` / `getBearing()` | `vm.camera.center()` / `zoom()` / `pitch()` / `bearing()` | |
| `vm.map.project(ll)` / `unproject(px)` | `vm.camera.project(ll)` / `unproject(px)` | Both agree with the drawn frame, including on decks (2c60e3ab6). |
| `vm.map.getBounds()` | `vm.camera.bounds()` | |
| `vm.map.getCanvas()` | `vm.frameCanvas()` | To read pixels: `await vm.captureFrame()`. |
| `vm.map.triggerRepaint()` | `(vm.map ?? vm.cameraMap).triggerRepaint()` | |
| `vm.map.jumpTo(opts)` | `(vm.map ?? vm.cameraMap).jumpTo(opts)` | For a plain centre, zoom, bearing and pitch: `vm.jumpToLngLat(opts)`. |
| `stop()`, `setMaxPitch`, `setVerticalFieldOfView`, `setPadding`, `calculateCameraOptionsFromTo` (the "pin a camera from eye to target" block copied across the strip specs) | the same calls on `vm.map ?? vm.cameraMap` | |
| `getCenter()` then `jumpTo({center: c + 1e-9})` (the "nudge to repaint" idiom) | `(vm.map ?? vm.cameraMap).triggerRepaint()` | |
| `getPixelRatio` / `setPixelRatio` / `once('render')` / `on('idle')` | the same on `vm.map ?? vm.cameraMap` | Or `await vm.camera.whenIdle()` for idle. |
| `vm.map.loaded()` / `isStyleLoaded()` / `areTilesLoaded()` used as a wait | `await vm.camera.whenIdle()` | |
| `vm.map.transform.*` | `vm.camera.*` where it exists | Otherwise leave it, guard with `test.skip(OWN, …)`, and list it. |
| Hiding symbol layers: `getStyle().layers` … `setLayoutProperty(id, 'visibility', 'none')` | `if (vm.map) { …as today… } else vm.setLabelsVisible(false);` | |
| Hiding basemap building or extrusion layers | `if (vm.map) { …as today… }` | Under own there is nothing to hide. |
| `getLayer`, `getSource`, `getLayoutProperty`, `getPaintProperty`, `getFeatureState`, `setFeatureState`, `queryRenderedFeatures`, `querySourceFeatures`, `getFilter`, `getLayersOrder` in an **assertion** | Leave the code. Add `test.skip(OWN, 'MapLibre style assertion: deleted with the default path at P5')` to that test, or `if (!vm.map) return` in a script. | These are the MapLibre-only reads. |
| `painter`, `_render`, `areTilesLoaded` in perf scripts | Leave them; `if (!vm.map)` → report `n/a (own)`. | The own frame timings are `vm.host.stats`. |

## Step 3 — files

### A. Camera and frame reads only: migrate before the flip (59)

These must pass under `ENGINE=own` afterwards.

- `tests/e2e/street-chunks.spec.ts` (7)
- `tests/e2e/own-ground-defects.spec.ts` (6)
- `scripts/gpu-load-ipad.mjs` (6)
- `scripts/check-artis-animals.mjs` (5)
- `tests/e2e/street-art-landmark-cards.spec.ts` (4)
- `tests/e2e/sculptures.spec.ts` (4)
- `tests/e2e/recipe-street.spec.ts` (6)
- `tests/e2e/intro-trace.spec.ts` (5)
- `tests/e2e/building-article-card.spec.ts` (4)
- `scripts/look/brick-tone-frames.ts` (4)
- `tests/e2e/roof-facts-shots.spec.ts` (3)
- `tests/e2e/own-ground-bridge-fidelity.spec.ts` (3)
- `tests/e2e/landmark-lod-perf.spec.ts` (3)
- `tests/e2e/context-restore.spec.ts` (3)
- `tests/e2e/building-types-runtime.spec.ts` (3)
- `scripts/review/capture-thousand-building-game.mjs` (3)
- `tests/e2e/weak-gpu-perf.spec.ts` (2)
- `tests/e2e/recipe-street-perf.spec.ts` (3)
- `tests/e2e/recipe-shops.spec.ts` (3)
- `tests/e2e/own-ground-parks.spec.ts` (2)
- `tests/e2e/landmark-shading.spec.ts` (3)
- `tests/e2e/intro-flight.spec.ts` (2)
- `tests/e2e/governor-no-flash.spec.ts` (2)
- `tests/e2e/feedback.spec.ts` (2)
- `tests/e2e/engine-parity.spec.ts` (2)
- `tests/e2e/briefing-pause.spec.ts` (2)
- `scripts/street-appearance/review-surveyed-envelope-game.mjs` (2)
- `scripts/live-play-shots.mjs` (3)
- `scripts/landmarks/review-zuiveringshallen.mjs` (2)
- `scripts/landmarks/review-westergas-hall.mjs` (2)
- `scripts/landmarks/review-pulitzer-amsterdam.mjs` (2)
- `scripts/landmarks/review-heineken.mjs` (4)
- `scripts/landmarks/review-haparandaweg-8-338.mjs` (2)
- `scripts/landmarks/review-amstel-hotel.mjs` (2)
- `scripts/landmarks/europarking-game-shots.ts` (2)
- `tests/e2e/westerpark-south-frames.spec.ts` (1)
- `tests/e2e/vondelpark-south-frames.spec.ts` (1)
- `tests/e2e/rosarium-roses.spec.ts` (1)
- `tests/e2e/review-sheet-ingame.spec.ts` (1)
- `tests/e2e/renderer-spike.spec.ts` (1)
- `tests/e2e/own-ground-prinsengracht-probe.spec.ts` (1)
- `tests/e2e/own-ground-marnix-bridge.spec.ts` (1)
- `tests/e2e/own-ground-citywide.spec.ts` (1)
- `tests/e2e/own-ground-bridges.spec.ts` (1)
- `tests/e2e/labels-free-ride-20261030.spec.ts` (1)
- `tests/e2e/intro-perf.spec.ts` (1)
- `tests/e2e/haparandaweg-street.spec.ts` (1)
- `tests/e2e/ferry-crossings.spec.ts` (1)
- `tests/e2e/engine-own.spec.ts` (2)
- `tests/e2e/city-startup-lod.spec.ts` (1)
- `tests/e2e/boat-start-zoom.spec.ts` (1)
- `scripts/street-appearance/review-frontage-probe.mjs` (1)
- `scripts/street-appearance/review-capture.mjs` (1)
- `scripts/review/homomonument-ground.browser.mjs` (1)
- `scripts/review/contained-poi-highlight.browser.mjs` (1)
- `scripts/landmarks/review-sheet.ts` (1)
- `scripts/landmarks/review-haparandaweg-8-338-pan.mjs` (2)
- `scripts/landmarks/ingame-capture.ts` (1)
- `scripts/landmarks/big-game.mjs` (1)

### B. Mixed: migrate the camera and frame reads, guard the MapLibre-only part (44)

The camera block migrates as in step 2. The listed MapLibre-only members are either setup (layer hiding: guard
with `if (vm.map)`) or assertions (skip under `OWN`).

- `tests/e2e/building-click-perf.spec.ts` (9) — MapLibre-only: getSource
- `tests/e2e/sun-heading.spec.ts` (7) — MapLibre-only: addLayer,getLayer,getStyle,setLayoutProperty
- `tests/e2e/recipe-tiles.spec.ts` (7) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/facade-tone.spec.ts` (6) — MapLibre-only: getStyle,setLayoutProperty
- `tests/e2e/shadow-fill.spec.ts` (6) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/mood-shots.spec.ts` (5) — MapLibre-only: getStyle,setLayoutProperty
- `tests/e2e/look-consistency.spec.ts` (5) — MapLibre-only: getLayer,getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/white-flash-probe.spec.ts` (5) — MapLibre-only: painter
- `tests/e2e/street-survey-retire.spec.ts` (5) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/period-walls-strip.spec.ts` (5) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/highlight.spec.ts` (4) — MapLibre-only: getFeatureState,getStyle,setLayoutProperty
- `tests/e2e/generic-gap-strip.spec.ts` (5) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/facade-trees-look.spec.ts` (7) — MapLibre-only: getLayersOrder,getPaintProperty,querySourceFeatures
- `tests/e2e/complete-city.spec.ts` (4) — MapLibre-only: getFeatureState,getSource,setFeatureState
- `tests/e2e/bike-xray.spec.ts` (4) — MapLibre-only: setLayoutProperty
- `tests/e2e/bag-tiles.spec.ts` (5) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `tests/e2e/three-buildings-ab.spec.ts` (3) — MapLibre-only: _render
- `tests/e2e/labels.spec.ts` (3) — MapLibre-only: getLayoutProperty,getStyle,queryRenderedFeatures
- `tests/e2e/filler-buildings.spec.ts` (3) — MapLibre-only: querySourceFeatures
- `tests/e2e/covered-passage.spec.ts` (3) — MapLibre-only: getPaintProperty
- `tests/e2e/block-face.spec.ts` (4) — MapLibre-only: querySourceFeatures
- `scripts/ride-perf-owners.mjs` (3) — MapLibre-only: _render,getStyle,painter
- `scripts/review/profile-driving-appearance.mjs` (3) — MapLibre-only: getLayer,getLayoutProperty,setLayoutProperty
- `scripts/pop-in.mjs` (3) — MapLibre-only: _render
- `scripts/perf-frozen-frames.mjs` (3) — MapLibre-only: areTilesLoaded
- `scripts/landmarks/review-afrikahuis.mjs` (3) — MapLibre-only: getSource
- `scripts/landmarks/review-afrikahuis-source.mjs` (3) — MapLibre-only: getLayoutProperty
- `tests/e2e/no-maplibre.spec.ts` (2) — MapLibre-only: areTilesLoaded
- `tests/e2e/centre-feedback.spec.ts` (2) — MapLibre-only: getLayoutProperty,getStyle,queryRenderedFeatures
- `scripts/street-appearance/review-marnixstraat-game.mjs` (3) — MapLibre-only: _render
- `scripts/landmarks/review-stadhuis.mjs` (2) — MapLibre-only: getSource
- `scripts/landmarks/review-palace-dam.mjs` (2) — MapLibre-only: getSource
- `scripts/landmarks/review-nieuwe-kerk.mjs` (2) — MapLibre-only: getSource
- `scripts/landmarks/review-nemo.mjs` (2) — MapLibre-only: getSource
- `scripts/landmarks/check-brasa-tunnel-game.mjs` (2) — MapLibre-only: getFilter,queryRenderedFeatures
- `scripts/highlight-outline-width.mjs` (2) — MapLibre-only: getStyle,setLayoutProperty
- `tests/e2e/ride-perf.spec.ts` (1) — MapLibre-only: getLayer
- `tests/e2e/highlight-shots.spec.ts` (1) — MapLibre-only: getLayoutProperty,getStyle,setLayoutProperty
- `scripts/ride-perf-places.mjs` (1) — MapLibre-only: getLayer,painter
- `scripts/ride-perf-fixed-route.mjs` (1) — MapLibre-only: getLayer,painter
- `scripts/look/region-mask.js` (1) — MapLibre-only: getLayoutProperty,getPaintProperty,getStyle,setLayoutProperty,setPaintProperty
- `scripts/landmarks/check-public-park-eight-game.mjs` (3) — MapLibre-only: getLayoutProperty,queryRenderedFeatures
- `scripts/landmarks/check-compact-public-park-game.mjs` (3) — MapLibre-only: getLayoutProperty,queryRenderedFeatures
- `scripts/highlight-perf.mjs` (1) — MapLibre-only: getLayer,painter

### C. MapLibre-only assertions: deleted with the default path at P5 (16)

Do not migrate these. Add `test.skip(OWN, …)` with that reason so `ENGINE=own` runs are green.

Exceptions: `answered-street-name.spec.ts` (a P1 gate spec) and `canal-recall.spec.ts` test a rule, not just a
MapLibre layer. Skip them under own **and** list them in the hand-back as "needs an own assertion". The own
labels are `vm._labels.placed` and the own lines are `vm._lines`; L1 will write the own versions.

- `tests/e2e/canal-recall.spec.ts` (8) — MapLibre-only: getLayoutProperty,getSource
- `tests/e2e/own-ground-roads.spec.ts` (8) — MapLibre-only: getLayersOrder,getStyle
- `tests/e2e/overview-transition.spec.ts` (6) — MapLibre-only: areTilesLoaded
- `tests/e2e/poi-lift.spec.ts` (6) — MapLibre-only: getLayer,getLayoutProperty,getPaintProperty,getStyle
- `scripts/look/transition-zoom.ts` (3) — MapLibre-only: areTilesLoaded
- `tests/e2e/answered-street-name.spec.ts` (2) — MapLibre-only: getLayer,getSource
- `scripts/look/overview-colours.ts` (2) — MapLibre-only: areTilesLoaded
- `scripts/landmarks/review-afrikahuis-label-baseline.mjs` (2) — MapLibre-only: getLayoutProperty
- `scripts/gpu-startup-timeline.mjs` (2) — MapLibre-only: painter
- `tests/e2e/touch-shader-warmup.spec.ts` (1) — MapLibre-only: painter
- `tests/e2e/own-ground-route-line.spec.ts` (1) — MapLibre-only: getLayer,getLayoutProperty,getPaintProperty
- `tests/e2e/own-ground-game.spec.ts` (1) — MapLibre-only: queryRenderedFeatures
- `tests/e2e/facade-trees-perf.spec.ts` (1) — MapLibre-only: _render
- `tests/e2e/building-look.spec.ts` (1) — MapLibre-only: getLayer,getLayoutProperty,getPaintProperty
- `scripts/motion-stutter.mjs` (1) — MapLibre-only: _render
- `scripts/landmarks/check-park-game.mjs` (1) — MapLibre-only: getLayoutProperty

### D. Check by hand (5)

The heuristic found a `vectorMap.map` read but no MapLibre member after it. Usually it is a
`const map = vm.map` passed on, or a `__jumpTo` hook. Read each one and treat it as A, B or C.

- `tests/e2e/osm-under-models.spec.ts` (2)
- `tests/e2e/phone-memory.spec.ts` (1)
- `scripts/teaser/lib.mjs` (1)
- `scripts/ring-edge-ride.mjs` (1)
- `scripts/check-signature-pyramidal-roofs.mjs` (1)

## Step 4 — verification (the named specs to re-run)

- **Each migrated spec:** run it on desktop twice, once default (`PW_PORT=4561 npx playwright test <spec>
  --project=desktop`) and once with `ENGINE=own` in front. It must be **green in both, or skipped under own
  with a reason**.
- **The P1 gate specs:** also run on `--project=iphone`, both engines: `look-consistency.spec.ts`,
  `labels.spec.ts`, `answered-street-name.spec.ts`, `intro-perf.spec.ts`, `context-restore.spec.ts`, plus
  `start-heading` and `open-squares` (no `vectorMap.map` reads; run them as controls).
- **Scripts:** run with `--help` or a dry run where they have one; otherwise `node --check` (or `npx tsc
  --noEmit`) is enough. Do not start long review captures.
- **A spec that was already red under the default engine before your change** (check by running it on `main`
  first): note it, and do not fix it.

## Hand-back

Post on #129 and return through SubagentHandback:

- Branch, HEAD and commit list.
- Per spec: default and own results.
- Files you could not migrate (missing camera member, `transform` internals), with the member named.
- The C-group specs that need an own assertion.
