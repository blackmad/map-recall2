# Lane: Transvaalbuurt round 3, the two kit blockers and the first 1911 installs (2026-11-01, #152)

Branch `lane/transvaalbuurt-install-3-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-install-3-20261101`, dev port 4879.
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus.

Rounds 1 and 2: `docs/handoffs/lane-transvaalbuurt-kit-20261031.md` (#149) and
`docs/handoffs/lane-transvaalbuurt-types-2-20261031.md` (#151), read their "State" sections.
Lessons: `docs/buurt-generator-20261016.md` "Transvaalbuurt lessons" (points 1-7).

## Why

The user photographed Albert Luthulistraat 29-31 and asked why a buurt of repeated designs
shows one modelled row. Round 2 put the stair-block frontage and the 1908-1914 five-storey
twins in the library; 15 pands on Oost placed and every one was then stopped by one of two
kit defects. The buurt still shows one installed row. This lane removes the two defects and
installs the 1911 rows that survive a gallery-size review. The acceptance bar is likeness to
the strip, not gates passing; "do not install" remains a valid outcome per face.

The 164 strips of both buurten are already in this worktree's `staging/block-face/<face>/strip.jpg`
(copied from round 2). Do not re-survey.

## Blocker 1: a point gable beside a cornice or dormer neighbour overlaps it

Every 1911 run that passed review fails the GLB audit (`zfight-tight` / `geometry-regression`)
with 1.2-2.3 m² of coplanar brick/roof-tile overlap where a `gable: point` pand stands next to a
pand with a cornice or dormers (Retiefstraat 69C-73A, Pretoriusstraat 79-87, Paardekraalstraat
1-15, Transvaalstraat 42-48; run dirs were not kept, re-run `auto-place` + `compile` to
reproduce). A `crownAt` inset did not clear it. Find where the gable's flank wall and the
neighbour's roof tile or parapet share a plane (`src/canalRecall/buildingRecipe/`, the gable
and roof builders; `scripts/block-face/glb-audit.ts` prints the parts and the m²) and fix the
geometry so the two pands meet without a coplanar face: the gable flank above the neighbour's
eaves is a party wall and must stand on its own plane, the neighbour's tiles stop at the party
line. Typed, tested, byte-identical for every installed face: `node --import tsx
scripts/block-face/roof-golden.ts` and `npm run -s test:building-recipes` must report 0
changes. If an installed face does change, say which and why in the report and stop.

## Blocker 2: the crown read puts point gables on flat fronts

The strip skyline assumes clean sky and reads trees, chimneys and neighbours' tops at
15.5-18.4 m on these rows, so `auto-place` chose `gable: point` on flat-topped fronts
(Smitstraat 36A-38C, Transvaalstraat 54-56, 100A-102B, Laing's Nekstraat 34-56, all held at
review). For a typed row the type's measured crown is the evidence and the skyline is only a
check. Change the crown decision so that: a type's crown is used unless the strip skyline is
read with confidence AND its pixels are sky-bounded (no foliage or neighbour mass above the
front, use the existing foliage/void measures in `autoPlace.ts` / `measureFacade`); when the
skyline is not sky-bounded the pand gets the type crown and the report says "crown from type".
Add the test that reproduces Smitstraat 36A (tree over the front, flat top) and keeps the
Albert Luthulistraat 25-39 and Bellamy runs unchanged (`autoPlace.test.ts`, roof-golden 0).

Also make the ribbon era guard per pand: it holds whole same-year rows when one pand reads
"ribbon" (12 of Transvaalstraat 7-41, 9 of Pretoriusstraat 72-96 for the wide three-light
windows of Transvaalstraat 33 and Pretoriusstraat 82). Hold the pand that reads ribbon, not
its row. Test with those two faces' records.

## Then install

1. Re-run auto-place for both buurten with the library
   (`npm run block-face:auto-place -- --buurt=transvaalbuurt-oost --district=transvaalbuurt --review`,
   then `-west`). Report the outcome split per buurt: vetoed before comparison / compared and
   held / placed, against round 2's numbers (Oost 147 / 279 / 15, West 263 / 36 / 0).
2. Compile every placed face and run the GLB audit. Review every one at gallery size beside its
   strip (`review.ts --face=`, the `review/strip-sheet.png`). Write holds to
   `scripts/block-face/buurten/transvaalbuurt-{oost,west}-review-holds.json` with a one-line
   reason each. A drawn gable on a flat front, a tower on a plain front, or a crown the strip
   does not show is a hold.
3. Batch-install the faces that pass, in ride order, Oost first
   (`scripts/block-face/batch.ts --name=transvaalbuurt-3-oost --buurt=transvaalbuurt-oost
   --district=transvaalbuurt --ride --install`, then West). Keep every installed run's
   `staging/block-face/<run>/review/strip-sheet.png`.
4. Before/after for the user: strip-over-model sheets of Transvaalstraat 3-47 and Retiefstraat
   45-75 (the two 1911 exemplar faces) at
   `staging/block-face/transvaalbuurt/round3/<face>-strip-over-model.png`, same layout as
   round 2's sheets, and a game screenshot of each installed row from the street
   (`PW_PORT=4879`, one Playwright run, name the spec) for the What's New note.

Do not author new types in this lane; the 1920-1922, 1926-1928 and 1929-1931 families are a
later lane. Do not loosen the GLB audit, the likeness gate or the review bar.

## Report

LANE-RULES hand-back block, plus: the outcome split per buurt before/after, the list of
installed faces with pand counts, the holds with reasons, what each blocker's fix changed in
one sentence each, and which installed-elsewhere faces (Bellamy, Albert Luthulistraat) were
re-compiled to prove byte-identity. INTEGRATOR TODO must name the covers and exposure rebuilds
(`npx tsx scripts/look/build-chunk-wall-exposure.ts --write`; `node --max-old-space-size=8192
--import tsx scripts/build-covers.ts --tiles=public/data/extracts/amsterdam/bag-tiles/14`, copy
`artifacts/bag-tiles/covers.json` to `public/canal-drive/models/covers.json`, `npm run
check:covers`) and the chunk GLBs committed. Do not touch `TODO.md`, `HISTORY.md`,
`whats-new-notes.json`, bundles, `covers.json`, goldens. Checks before hand-back: `npm run -s
test:block-face`, `npm run -s test:building-recipes`, `node --import tsx
scripts/block-face/roof-golden.ts`, `npm run lint`, `npm run check:covers` is the integrator's.
