# Lane: the second, bouncing route line under own ground (presentation, 2026-10-13)

User 2026-10-13, desktop screenshot on the deployed build (922de98, `?ownGround=1`,
over the Kostverlorenvaart in the Chassébuurt with the "Which waterway are
you on now?" question open): "getting this crazy bouncy moving second line on
this highlight". The shot shows the route drawn twice along the canal: a
wide yellow-edged band with a blue core and a white centre stripe, and a
second blue/white line beside it that moves relative to the first as the
camera moves. Expected: one draped route ribbon (dark casing, blue core) on
the water or road surface, the question street's highlight as one draped
band, and nothing drawn flat at z = 0 while own ground is on.

Candidates, check each on current `main` with `?ownGround=1` at that spot
(4.8705, 52.3735, chase view, boat or bike):
- the MapLibre flat overlays (`navigation-route-casing`, `navigation-route-line`,
  `active-street-line`, `cycle-tracks`) are meant to be hidden by
  `OWN_GROUND_HIDDEN_OVERLAYS` in `_setBasemapGroundHidden` (`vector-map.js`
  ~2059); the 2026-10-13 ground lanes changed that function and the style
  re-apply at ~3203. Verify the opacities really are 0 after a theme change,
  a style swap and a cell load, and when the route is re-set
  (`_ownGroundRoute`, lines ~2332 / ~2416);
- the draped ribbons (`gameGround.ts` `rebuildOverlays`, `routeRibbon(l, H, …)`)
  are rebuilt on every `surfaceRevision` bump; while cells stream in, the
  height function changes under the ribbon and it jumps (the "bouncy"): drape
  on the committed surface only, or ease the rebuild;
- `hud.js drawRouteLine` (dashed blue canvas line, yellow end dot) and any
  other 2D canvas route/highlight drawing in `presentationRuntime.ts` that
  projects world points without ground height; it must not draw while own
  ground is resident;
- the yellow edge: nothing in the own-ground materials is yellow; find the
  layer that is (the quiz "answered street" amber in `streetOverlayStyle.ts`?
  the transit-rail amber at `vector-map.js` ~455?).

Lane owns `src/canalRecall/ownGround/gameGround.ts` overlays, `streetOverlayStyle.ts`,
the HUD route drawing; ≤ 15 reported lines in `vector-map.js`; do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. The cause, with a screenshot reproducing the two lines on current main.
2. The fix: one route ribbon and one highlight band under own ground, stable
   while cells load, no flat line; the default MapLibre path unchanged.
3. A Playwright spec at that spot that counts route-coloured pixel runs
   across the canal (one band, not two) in two frames 2 s apart with the
   camera orbiting, and before/after shots.

## Checks
`npm run lint`, `npm run test:own-ground`, `OWN_GROUND=1 PW_PORT=<yours> npx
playwright test own-ground-game --project=desktop`, the new spec. Report:
branch, SHA, the cause, shots, the `vector-map.js` lines, unfinished.
