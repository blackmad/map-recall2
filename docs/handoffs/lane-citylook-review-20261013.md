# Lane: city look, gallery review and the road to default-on (look, 2026-10-13)

Context: `docs/LOOK.md`, `src/canalRecall/look/{cityLook,palette,slotCells}.ts`,
`docs/handoffs/lane-citylook-atlas-20261013.md`, HISTORY 2026-10-13
"Migration steps 1 and 2 behind flags". `?cityLook=1` (with `?sharedFrame=1`)
dresses landmarks, recipe houses and generic extrusions from one texture
array; legacy GLB slots are inferred at load. Known from the integrator's
demo shots: under `?cityLook=1` the landmark highlight renders as a flat
unshaded yellow (the default highlight keeps its shading); brick luma 117
sits above LOOK.md's 95–110 target because slot tints pass through
`cityTint`; one brick variant only; ambiguous inferred slots (`white` →
stucco 241 models, `dark` → frame 272, `ochre` → brick 38, `red` → brick 104);
slate roofs come out darker. Lane owns `look/*`, the shaders, the inference
rules in `scripts/landmarks/infer-material-slots.ts`, `tests/e2e/building-look*`,
`look-consistency` baselines. Do not edit `game.js`, `index.html`,
`package.json`, bundles, catalogues, `TODO.md`, `HISTORY.md`; the default
flip itself is the integrator's call — report the evidence.

## Deliverables
1. **Highlight variant**: make the city-look highlight keep the Lambert
   shading (tinted, not flat); Playwright shot at the Westerkerk and the Dam
   before/after, both flags.
2. **Luma and brick**: bring brick luma into the LOOK.md band without
   touching the flag-off path; add a second brick variant (lighter, 20th c.)
   chosen by BAG year, and a stucco variant for the `white` class.
3. **Gallery review of all 302 landmarks** under `?cityLook=1&sharedFrame=1`
   at gallery-card size: a contact sheet per 30 (`scripts/landmarks/*strip*`
   or `tests/e2e/demo-shots.spec.ts`-style standpoints), flag-off beside
   flag-on, and a triage table: looks right / inference wrong (fix the rule or
   tag the builder material) / needs the builder. Fix the inference rules
   that are wrong for ≥ 3 models; tag builder materials for the rest where
   it is a one-line edit (export GLB + lod1, `audit:glb` still PASS).
4. **Perf and the flip evidence**: desktop ms per frame with
   `scripts/ride-perf-fixed-route.mjs` for flag off, `sharedFrame` only, and
   both; texture memory; `test:look`, `building-look`, `look-parity`,
   `look-consistency` green. Write the recommendation (flip both, flip
   sharedFrame only, or wait) with the numbers in `docs/LOOK.md`.

## Checks
`npm run lint`, `npm run test:look`, `PW_PORT=<yours> npx playwright test building-look look-parity look-consistency --project=desktop`.
Report: branch, SHA, the shots, the triage table, perf numbers, recommendation.
