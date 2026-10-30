# Lane L2: specs stop reading `vectorMap.map`; P0 deletions

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` §P0. Model:
haiku. Mechanical; every step has a command and a pass/fail output.

## Why

101 spec and script files read `vectorMap.map.*` (MapLibre's `project`,
`unproject`, `getCenter`, `getZoom`, `getBounds`, `getPitch`, `getBearing`,
`once('idle')`, `_render` timing, …) as their oracle. The engine lane (L1)
adds a second `VectorMap` implementation without MapLibre; those readers must
go through one facade surface first.

## Build

1. **Inventory.** `grep -rn "vectorMap\.map\b\|vectorMap()\.map\|\.map\._render\|map\.project\|map\.unproject\|map\.get\(Center\|Zoom\|Bounds\|Pitch\|Bearing\)" tests/e2e scripts src --include=*.ts --include=*.mjs --include=*.js`
   → `docs/handoffs/oracle-inventory-20261030.md`: a table of member → count
   → files. Members used by fewer than three files get a note.
2. **The facade surface, MapLibre-backed.** In `public/canal-drive/js/vector-map.js`
   add `this.camera = { project(lngLat), unproject(px), center(), zoom(),
   bounds(), pitch(), bearing(), onFrame(cb) /* one callback per render */,
   whenIdle() /* promise */ }` implemented over `this.map`. This is the only
   edit you make to that file besides step 5. Add a `/** @implements
   {import('../../../src/canalRecall/engine/worldViewApi').WorldView} */` line
   once L1's `worldViewApi.ts` exists on main; until then leave a TODO comment.
3. **Migrate** every reader from `.map.<member>` to `.camera.<member>`; where a
   spec timed `map._render`, time `camera.onFrame`. One commit per directory
   (`tests/e2e`, `scripts`, `src`). Run each migrated spec once on desktop
   (under `/tmp/canal-pw.sh`, `PW_PORT=<port>`): same pass/fail as before the
   change. Specs that fail before the change are listed, not fixed.
4. **Delete** (P0, agreed): `src/canalRecall/studyFacadesBrowser.ts`,
   `studyRoofsBrowser.ts`, `studyTreesBrowser.ts`, `studyPublicRealmBrowser.ts`,
   their `build:canal-study-*` scripts (report the `package.json` lines; do not
   edit it), their bundles (`js/study-*.bundle.js`, report), and
   `_updateStudyAreaResidency` + `_appearanceAreas` in `vector-map.js`;
   `public/canal-drive/js/google-tiles-source.js`, `google-tiles-spike*`,
   `public/canal-drive/google-tiles-spike.html`, `src/canalRecall/*googleTiles*`,
   `setGoogleTilesEnabled` and `googleTiles` in `preferences.ts`, the
   `canal:google-tiles-config` build step (report) and `scripts/write-canal-google-tiles-config*`.
   Grep for every remaining reference; the Storybook and the overlay settings
   must not show a Google tiles toggle afterwards.
5. **Perf gate skeleton.** `tests/perf/budgets.json` with the P0 baselines
   written as numbers with their source and date (draws 851, programs 32,
   `MOTION_BUDGET {200,1,4}`, iPhone profile heap 245 MB / ArrayBuffers 67 MB /
   GL buffers 140 MB / MapLibre workers 94 MB, time-to-ride 7.5 s dated
   2026-10-06) and `scripts/perf-gate.mjs` that runs `scripts/ride-perf-owners.mjs`,
   `scripts/motion-stutter.mjs` and `scripts/pop-in.mjs` for one variant string,
   collects their JSON into `artifacts/perf/gate-<variant>-<date>.json`, and
   prints a one-line table against `budgets.json`. Run it once for `""`
   (default) and record the numbers in the hand-back; do not change any budget.

## Checks

`npm run lint`; `npm run check:canal`; `PW_PORT=<port> npx playwright test
ride-perf labels intro-perf --project=desktop` under the lock after the
migration.

## Hand back

The `LANE-RULES.md` block, plus: the inventory table path, files migrated
(count per directory), specs that were already failing, the exact
`package.json` lines to remove, bundles to delete, and the gate table.
