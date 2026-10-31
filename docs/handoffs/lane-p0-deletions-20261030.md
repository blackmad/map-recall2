# Lane: P0 deletions — study layers, Google photoreal tiles, the shared-frame flag

Rules: `LANE-RULES.md`. Programme: `engine-programme-20261030.md` §P0
("Delete now"). Model: opus. Port: 4533. Branch `lane/p0-deletions-20261030`
from `origin/main`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/p0-deletions-20261030`
(`scripts/worktrees/new.sh lane/p0-deletions-20261030 <that dir> 4533`).

## Why

The user decided on 2026-10-30 that the Google photoreal tiles layer and its
spike go, and that the study layers (roofs, facades, trees, public realm) go:
they are research overlays nobody rides with, every one of them a MapLibre
custom layer or a three.js participant that `vector-map.js` constructs,
streams (`_updateStudyAreaResidency`) and keeps resident. `vector-map.js` is
frozen to fixes and will be deleted whole at the flip; the fewer systems it
owns until then, the smaller the second implementation (`?engine=own`) has
to be. The shared frame has been forced on since own ground became the
default; `SHARED_FRAME_DEFAULT=false` and the flag path that reads it are a
dead branch that still costs a read in every participant.

## This lane may edit integrator-owned files

Deletion is the whole task, so on this branch you may edit `vector-map.js`,
`game-route.js`, `index.html` and `package.json` (removals only) and delete
dead bundle files. Do **not** rebuild or commit any surviving bundle; list
the rebuild commands in the hand-back and the integrator runs them.

## Delete

1. **Study layers.** `src/canalRecall/study{Roofs,Facades,Trees,PublicRealm}Browser.ts`
   and their tests; `public/canal-drive/js/study-*.bundle.js` (+ `.map`);
   `package.json` `build:canal-study-*` lines and their place in the `build`
   chain; `index.html` the four `<script>` tags (l.1411–1416); in
   `vector-map.js` the `_study*` fields (l.187–194), the constructor table
   (l.1619–1622), `_updateStudyAreaResidency` and its listener
   (l.1643–1645, 2043, 2194, 2207–2256), the debug readout entries
   (l.3400, 3422). Consumers that are not the game: `scripts/review/
   study-observed-sign-aspect.test.ts` imports `observedSignAspectRatio`
   from `studyFacadesBrowser.ts` — move that one pure function (and its
   test) to `src/canalRecall/review/signAspect.ts` if anything else uses it,
   else delete both. `scripts/city-appearance/publish-area-geometry-demo.ts`,
   `validate-district-release.mjs`, `build-district-evaluation-report.ts`,
   `scripts/review/capture-thousand-building-game.mjs` and
   `scripts/check-city-appearance-roofs.ts` write or read `studyRoofs` /
   `studyFacades` manifest sections of the city-appearance release: keep the
   manifest fields (data on disk), delete only what loads them into the
   ride. If one of those scripts is itself dead (no npm script, no test, no
   doc names it), say so in the report; do not delete it in this lane.
2. **Google tiles.** `public/canal-drive/js/google-tiles-source.js`,
   `google-tiles.bundle.js`, `google-tiles-spike.bundle.js`,
   `scripts/build-google-tiles-spike.mjs`,
   `scripts/write-canal-google-tiles-config.ts`, the entry in
   `scripts/build-3d-bundles.mjs` (l.75), `package.json`
   `canal:google-tiles-config` and `build:google-tiles-spike`; `index.html`
   the module script tag (l.1417), the attribution div (l.1441) and its CSS
   (l.40); in `vector-map.js` `_googleTiles*` fields (l.207–209),
   `setGoogleTilesEnabled`, `_updateGoogleTiles`, `setGoogleAttribution`
   (l.2053–2120), the `const google = this._googleTilesActive` read
   (l.2166) and the call at l.3160; `game-route.js:192` the
   `setGoogleTilesEnabled` call; `src/canalRecall/game/preferences.ts`
   `googleTiles` (l.201, 262, 355) — keep `parsePreferences` tolerant of the
   stored key (it is already a retired key per
   `scripts/check-canal-preferences.ts:136-139`; adjust that assertion to
   "ignored", do not drop the test); `tests/e2e/google-tiles-option.spec.ts`
   deleted; `wallMaterialDemo.ts:84` reference; any `engine/worldViewApi.ts`
   method or `ownWorldView.ts` stub for Google tiles (grep
   `GoogleTiles|googleTiles`). Any spike page under `public/` that only the
   spike bundle served: delete it and say which.
3. **Shared-frame flag.** `SHARED_FRAME_DEFAULT` (`vector-map.js:27`) and the
   `canalRecallLookFlag('sharedFrame', …)` read at l.158: the shared frame
   is unconditional. Remove the `?sharedFrame=0` path in `vector-map.js`
   only; **measure** how much of the participants' legacy `_makeLayer`
   (non-shared custom layer) branches become unreachable and report the
   line count per file instead of deleting them in this lane, unless a
   branch is under 20 lines and has no test naming it. Any spec that sets
   `sharedFrame` (grep `sharedFrame` in `tests/`, `scripts/`): drop the
   parameter, keep the spec.

## Keep

`sharedFrame.ts` itself, `ownGround`, every three.js participant, the
city-appearance release data under `public/data/`, the `measuredColoursOnly`
preference (the Google condition at `game-route.js:192` was the only coupling).

## Checks

`npm run lint`; `npm run test:canal-preferences` (or the script that runs
`check-canal-preferences.ts`); `node --import tsx --test` on every test file
you touched; `grep -rn -iE "study(Roofs|Facades|Trees|PublicRealm)|googleTiles|google-tiles|SHARED_FRAME_DEFAULT" public/canal-drive src scripts tests docs --include=*.{ts,js,mjs,html,json,md} | grep -v bundle` must return only the city-appearance manifest readers you kept and HISTORY/docs; under the lock, `PW_PORT=4533 /tmp/canal-pw.sh npx playwright test boot-smoke start-heading labels --project=desktop --workers=1 --trace off` with the integrator-rebuilt bundles **not** available to you: build them into a scratch dir (`esbuild … --outfile=/tmp/…`) and serve with `BUNDLES_DIR` if the spec supports it (see `tests/e2e/helpers.ts`), else run the boot smoke only and say so.

## Hand back

The block from `LANE-RULES.md`, plus: lines deleted per file, the surviving
non-game readers of the study manifests, the `_makeLayer` dead-branch table,
and the integrator's rebuild list (`npm run build:canal-ui`? no — only the
bundles whose sources you touched; likely `build:canal-preferences`,
`build:canal-engine`, `node scripts/build-3d-bundles.mjs`).
