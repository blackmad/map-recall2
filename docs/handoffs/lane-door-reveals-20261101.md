# Lane: inset doorways (door reveals and portieken) in the kit houses (2026-11-01, #181)

Branch `lane/door-reveals-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/door-reveals-20261101`, dev port 4827
(`PW_PORT=4827`, Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs).
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus. Never `pkill`; stop your
server by its port's PID. Do not open `TODO.md`, `HISTORY.md` or `buildings-pipeline.md`.

## Why (user, 2026-11-01)

"Something I notice with our kit houses: we really fail to capture the way most Amsterdam houses
have an inset doorway." True. Every block-face type (89 types in `scripts/block-face/types/<library>/`,
11 libraries) describes its door as a colour, a bay and an arch; `buildingRecipe/fit.ts` (~line 554)
draws the door as a panel 10 cm *proud* of the wall. The only recess in the kit is the per-opening
`recessM` / `recessReturns` of the individually modelled canal-house recipes
(`src/canalRecall/canalhouseOpeningRecess.ts`, `canalhouseRecipes.ts`), and the Transvaalbuurt loggia
(`buildingRecipe/frontLoggia.ts`, `FrontIntent.loggia`, #158), which is the precedent for a recessed
element on an ordinary front: an intent field, the opening cut into the wall with jambs, soffit and
sill, byte-identical when absent.

## What to build

1. **Kit component**: `FrontIntent.doorReveal` (name it as the code base names things), typed and
   unit-tested, byte-identical when absent (`fit-golden.ts` unchanged until you set it on a type;
   `roof-golden.ts` 0; `test:building-recipes` and `test:block-face` green). The door opening is
   cut `deep` metres into the wall: brick jambs in the wall colour (a stone or painted jamb where
   the type says so), a soffit, the door leaf and its fanlight translated to the back, the
   threshold with its step(s) inside the reveal, the stoop (`basement: stoop`) meeting the reveal
   correctly. Two forms: the shallow **reveal** of the 1880–1915 single-house rows, and the deeper
   **portiek** (a shared vestibule with the stair door at the back and the letterboxes/bells on
   the side wall, often two flats' doors) of the 1900–1935 rows and Amsterdam School blocks,
   where the ground floor already has `doorArch`/portiek-like arches. Both read from the street
   mostly as shadow: judge them at gallery size and from the cockpit.
2. **Measure, do not assume.** For each library, two or three pands from the city panoramas
   (`scripts/landmarks/*-survey.ts` show the pano fetch) and the strips in
   `MAP_RECALL_SOURCE_DATA/block-face-strips/<face>/strip.jpg`: the reveal depth from the visible
   jamb return at a known viewing angle, the step count, whether the jamb is brick, stone or
   painted, where the fanlight sits. Record every measurement with its photo in the type's
   `note`/`citation` fields the way the existing palette evidence is written. Expect, but verify:
   shallow reveals of a few decimetres on the 1880–1915 rows, portieken of a metre or more on the
   1920s rows; shops flush.
3. **Set it on the types the photos justify**, library by library in ride order (centre and
   inner ring first: jordaan, oud-west, helmersbuurt, de-pijp, museumkwartier, transvaalbuurt,
   then the rest). Recompile the installed chunks of the types you changed to staging, review
   every changed row at gallery size beside its strip (before | after | strip), and install the
   ones that read right (`scripts/block-face/batchInstall.ts` pattern; commit chunk GLBs and
   `chunks.json`; the roof and fit goldens re-recorded with `--write` only after you have read
   the CHANGED list and it holds only the rows you meant). Rows that read worse stay as they were,
   with the reason in the report.
4. **Generic fronts** (the non-kit c19 houses, `facadeOrnaments.ts` `portiek` dresses a flush
   painted door): say in the report what it would take; do not do it in this lane.

## Checks before hand-back

`npm run lint`; `npm run -s test:building-recipes`; `npm run -s test:block-face`;
`node --import tsx scripts/block-face/roof-golden.ts`; `node --import tsx scripts/building-recipes/fit-golden.ts`
(0 unexpected changes); one named Playwright spec with before/after frames at gallery size and
from the cockpit for three rows (desktop + iPhone), under `/tmp/canal-pw.sh`.

## Report

LANE-RULES hand-back block plus: the measurement table (library, pand, depth, steps, jamb
material, photo), the types changed with their values, chunks recompiled / installed / held
with reasons, triangles added per house, what the kit still cannot say (curved reveals, tiled
portiek walls, iron gates, bell panels), and the INTEGRATOR TODO (covers after installs:
`node --max-old-space-size=8192 --import tsx scripts/build-covers.ts --tiles=public/data/extracts/amsterdam/bag-tiles/14`
then `npm run check:covers`; exposure rows `npx tsx scripts/look/build-chunk-wall-exposure.ts --write`;
`npm run build:buurt-pages`; `node --import tsx scripts/explorer/build-looks.ts`; the What's New
before/after pairs). Do not touch `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, bundles,
`covers.json`, `index.html`, `game.js`, `package.json`.
