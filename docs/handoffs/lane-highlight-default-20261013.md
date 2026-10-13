# Lane: make highlight "a" the default and finish its gaps (presentation, 2026-10-13)

`lane-highlight-redesign-20261013.md` delivered three candidates behind
`?highlight=a|b|c` (`src/canalRecall/look/highlight.ts`,
`highlightMarker.ts`, `highlightLandmarks.ts`; sheets in
`docs/reports/highlight-redesign-20261013/`; LOOK.md §Highlight) and
recommended a (materials kept, 2-px inverted-hull outline in `#ff8033`, a
soft 4 m ground band round the footprint, a 3-px beacon over the roof; no
per-frame cost, +22–26 draw calls). The integrator decides: **ship a as the
default** (the user asked for "a better landmark highlight than yellow";
the yellow box hides the building the player is meant to learn). Known
gaps from the lane: the outline is subtle at chase distance on an ordinary
terrace house (the beacon carries it there); MapLibre's fallback extrusion
layers (only when three.js does not own the city) and 3DBAG detailed mode
keep yellow.

Lane owns `src/canalRecall/look/highlight*.ts`, the highlight stories and
specs (`stories/canal-drive/Highlight.stories.tsx`,
`tests/e2e/highlight.spec.ts`, `highlight-shots.spec.ts`), ≤ 10 reported
lines in `vector-map.js` for the MapLibre fallback paint. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Default flip**: `highlightStyle()` returns `a` when `?highlight` is
   unset; `?highlight=yellow` keeps the old look for comparison; every
   pipeline (landmark GLBs, recipe houses, recipe tiles, building types,
   generic extrusions, both frames) and the Storybook states follow. The
   HUD destination chip and the labels lane's destination label use the
   same accent (`HIGHLIGHT_CORAL` in `palette.ts`), one accent in the world.
2. **Chase-distance legibility**: measure the outline's on-screen width at
   the chase camera on a 6 m-wide terrace house (Oud-West sheet) and at the
   saddle; if under 1.5 px, scale the hull offset with distance (clamped,
   no per-frame uniform churn: a per-chunk uniform updated on camera moves
   is fine). The building itself must stay readable (no fill tint).
3. **Fallbacks**: MapLibre fallback extrusions and 3DBAG detailed mode take
   the accent as an outline/casing, not yellow fill. The answer stays
   hidden until revealed (LOOK §Driving corridor readability; the street
   under question must never be shown by the highlight).
4. Sheets regenerated (`docs/reports/highlight-redesign-20261013/`), the
   perf numbers re-measured with `scripts/highlight-perf.mjs` (desktop
   first; iPhone profile recorded as pending).

## Checks
`npm run lint`, `npm run test:look`, `npm run build-storybook`,
`PW_PORT=<yours> npx playwright test highlight building-look
--project=desktop` and `--project=iphone`. Report: branch, SHA, widths
measured, draw-call and ms deltas, sheets, unfinished.
