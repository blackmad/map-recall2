# Lane: a bridge renderer for the canal bridges (ground, 2026-10-13)

User 2026-10-13, two screenshots on the deployed build with `?ownGround=1`:
(1) a Prinsengracht-class bridge drawn as a chunky brown slab with a dark
railing, abutments cut square, a brown underside showing as a smear, the
deck floating over the water with no arch, no coping, no lamp posts; "can
you implement a better renderer for this kind of bridge and use it where
else it's needed? a couple of Prinsengracht bridges look like that too",
and (2) "bridges still need help": a second bridge at a canal junction with
the same slab, plus a smaller bridge beside it whose deck and railings
read as two loose plates. The Magere Brug note from the bridges-elevation
lane also stands: its two bascule units read as one white gantry.

Inputs: `src/canalRecall/ownGround/decks.ts` (deck tops, abutments,
railings, piers, arches, movable frames; `DeckBuildInfo`, `measuredDeckTop`,
`movableFrame`), `groundCell.ts` (bridges at step 0.75 LOD0), `gameGround.ts`
(materials, `DRAW_RANK`), the measured decks
(`public/data/extracts/amsterdam/elevation-v1/bridges.json`, 931 AHN
profiles; `bridge-surfaces-v2`), the municipal bridge register
(`scripts/build-bridge-register.ts`, names, BRU ids, `bridge:movable`,
`colour`, material tags from OSM), `docs/elevation.md` (known gaps),
HISTORY "bridges elevation" (2026-10-13). Lane owns `decks.ts` and a new
`bridgeKit.ts` under `ownGround/`, the bridge materials in `gameGround.ts`,
the bridge regressions and specs; ≤ 10 reported lines in `vector-map.js`.
Do not edit `game.js`, `index.html`, `package.json`, bundles, `TODO.md`,
`HISTORY.md`. Open data only (OSM, AHN, the register, panoramas CC BY 4.0
for reference).

## Deliverables
1. **A bridge kit by type**, chosen from the register and OSM tags, with
   the measured deck profile as the spine:
   - *arched masonry* (the canal-belt standard: brick or stone arch per
     span, stone coping and keystone band, brick spandrels, a balustrade of
     stone posts with iron rails, lamp posts at the quarter points): spans
     from the deck length (one arch under ~12 m, three over), arch rise from
     the hump, abutments that meet the quay wall at the quay's height, no
     brown underside visible;
   - *flat girder* (post-war and outer canals): steel or concrete edge
     beams, a thin deck, simple railing, piers at the measured positions;
   - *bascule* (the Magere Brug and the other movable bridges): two
     balance-beam gantries 4 m apart in the bridge's `colour` (white for
     the Magere Brug, most are dark green or grey), the leaf as a separate
     plate, the counterweights; the Magere Brug as the named regression;
   - *footbridge* for the small ones (the second bridge in shot 2).
2. **Every bridge keeps its measured top** (the elevation lane's clamps:
   humps at most 1:8, deck top at the railing base) and its physics; the
   rider's deck profile must not change (pin with the bridge sweep /
   driving harness regressions).
3. **Cost**: a bridge is ≤ 600 triangles at LOD0 and ≤ 60 at the far ring;
   measure the belt's bridges resident vs ms per frame on desktop.
4. Shots at the user's two spots (chase and 300 m; find them from the
   screenshots: shot 1 is a Prinsengracht-class bridge over a canal with a
   white house on the near corner, shot 2 a junction of two canals with a
   footbridge beside the main bridge), the Magere Brug, the Blauwbrug, the
   Torensluis, before/after.

## Checks
`npm run lint`, `npm run test:own-ground`, `npm run check:own-ground-cells`,
`npm run check:own-ground-belt`, `OWN_GROUND=1 PW_PORT=<yours> npx
playwright test own-ground-game --project=desktop`, `npm run test:canal-car`
(bridge regressions). Report: branch, SHA, shots, per-type triangle counts,
perf delta, the `vector-map.js` lines, unfinished.
