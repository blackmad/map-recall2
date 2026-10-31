# Lane: Transvaalbuurt round 2: the portiek width veto and the 1911–1913 five-storey type, 2026-10-31

Branch `lane/transvaalbuurt-types-2-20261031`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/transvaalbuurt-types-2-20261031`, dev port 4548.
Rules: `docs/handoffs/LANE-RULES.md`. Method: `docs/buurt-generator-20261016.md`, read its
"Transvaalbuurt lessons" section first. Round 1: `docs/handoffs/lane-transvaalbuurt-kit-20261031.md`
(HISTORY "Transvaalbuurt kit"). Model: Opus for the veto design, the type and the review; Haiku for
auto-place runs, batches, compiles and the report.

## Why

Round 1 installed Albert Luthulistraat 25–39 and reported a buurt-wide auto-place yield of 0. The
strips, grouped by build-year family (the user's comparison page, 2026-10-31), show two things:

1. **The installed 1923 portiek design stands on more streets** than the one row: Schalk
   Burgerstraat 2–140 (`burger-2-140`, 9 pands, 1923), Krugerstraat 4–28 (`kruger-4-28`),
   Retiefstraat 194–268 (`retief-194-268`, 1921), Tugelaweg 19–31 (`tugelaweg-19-31`, 1922),
   Transvaalstraat 106–140 (`transvaal-106-140`). Auto-place vetoed them on **frontage width**:
   `autoPlace.ts` line ~238 (`widthSlackM: 0.4`) rejects any pand outside the type's frontage fit
   (8.8–12.9 m). That rule comes from the Bellamy pilot, where a pand is one house. In the
   interwar buurten a pand is a **stair block** whose width runs 7–17 m for one design.
2. **The largest family in the buurt has no type**: the 1908–1914 five-storey rows (274 pands on
   37 photographed faces; Transvaalstraat 3–47, Retiefstraat 45–75 and 3–41, Pretoriusstraat
   14–48, 72–120, 71–95, 1–33, Majubastraat 1–151, Retiefstraat 83–105, Paardekraalstraat,
   Ingogostraat, Laing's Nekstraat 31–43). Pitched roofs with dormers, bay windows and balconies
   on alternating axes, light cornices, 6–9 m pands, 3DBAG eaves 12–16 m. Every pand was vetoed
   on build year (the library covers 1921–1924) before any photo was compared.

The 157 strips from round 1 are copied into `staging/block-face/<face>/strip.jpg` here (untracked).
The survey, placement and intake files are committed (`scripts/block-face/buurten/transvaalbuurt-*`,
`scripts/block-face/faces/<face>/`). Do not re-survey.

## Steps

1. **Opus: the width veto for portiek types.** Add a typed way for a type to say "pand width is
   not a veto" (for example a `match.frontage: "stair-block"` mode or an explicit `frontageM`
   range with `frontageVeto: false`), and veto on what does identify the design instead: the bay
   rhythm (axis pitch from the strip columns against the type's bays, or `bayWidths`) and the
   storey count. Keep the existing behaviour byte-identical for every other library (fit-golden,
   `autoPlace.test.ts`, the Bellamy/Jordaan calibrations). Add a test with a 7 m and a 14 m
   stair block of the Transvaal type. Apply it to both `transvaalbuurt` types.
2. **Haiku:** rerun `block-face:auto-place -- --buurt=transvaalbuurt-west --district=transvaalbuurt --review`
   and the same for `-oost`. Report placed/held per face before and after. Expected: the five
   faces above place; everything from other years still holds. **Opus:** review the new run
   sheets at gallery size beside the strips; hold false positives in the `-review-holds.json`.
3. **Opus: author `transvaal-1911-five-storey`** (and a variant if the strips force one: with and
   without bay windows, or odd/even balcony rhythm) in `scripts/block-face/types/transvaalbuurt/`.
   Measure from at least three faces of the family (Transvaalstraat 3–47, Retiefstraat 45–75,
   Pretoriusstraat 72–120): storey heights, window heights, head lines, dormer pitch and spacing,
   balcony depth, bay width. Never tune for one face. `match.years` [1908, 1914].
4. **Opus:** the kit components the family needs, typed, tested, byte-identical when absent.
   Likely: balconies on alternating axes with railings (`historicBalconies`/balcony assemblies
   may already do this; say what you reused), dormers at a measured pitch, a light cornice.
5. **Haiku:** rerun auto-place, then
   `node --import tsx scripts/block-face/batch.ts --name=transvaalbuurt-2-<slug> --buurt=<slug> --district=transvaalbuurt --ride --install`
   per buurt in ride order; commit per buurt.
6. **Opus:** review sheets at gallery size; hold false positives; one before/after strip for the
   user of Transvaalstraat 3–47 (strip over model ortho) and one of Schalk Burgerstraat 2–140.

## Report (in addition to the LANE-RULES block)

- Pands by outcome before and after, split **vetoed before the photo was compared** vs
  **compared and held** vs **placed**. A "0 placed" number without that split is not a result.
- The remaining families with no type, with pand counts: the 1929–1931 blocks (120 pands, round
  corner towers, arched passages), the 1920–1922 three-storey rows (129), the 1926–1928
  band-window rows (50).

## Acceptance

Likeness beside the strips at gallery size, not gates. Per-pand edge NCC is a floor, not a pass.
Budget about 250 tool turns. Commit as you go; do not push or merge; do not touch `TODO.md`,
`HISTORY.md`, `whats-new-notes.json`, bundles, `covers.json`, goldens. Checks before hand-back:
`npm run -s test:block-face`, `npm run -s test:building-recipes`,
`node --import tsx scripts/block-face/roof-golden.ts`, `npm run lint`.

## State (2026-10-31, lane hand-back)

- **Width veto (step 1)**: `match.frontage: {mode: "stair-block", widthM, storeys, axisPitchM}` (`autoPlace.ts`
  `frontageVetoes`). Absent = the house fit-width veto, byte-identical. Both 1923 portiek types opt in (5-18 m blocks,
  4 storeys at the type pitch, 1.6-6.5 m axis pitch). Test: a 7 m and a 14 m stair block, Retiefstraat 220's 0.78 m
  pitch, a 27.7 m corner block, 3- and 5-storey eaves.
- **Step 2 result**: the premise held on Schalk Burgerstraat 2-140 only. Retiefstraat 194-268, Tugelaweg 19-31,
  Transvaalstraat 106-140 and Krugerstraat 4-28 are other designs (plain flat rows, oriel rows with roof dormers, the
  1925 lisene design); the edge-NCC gate held most of them. Schalk Burgerstraat 18 and 28 passed (NCC 0.29/0.17) but are
  held at review: BAG splits that design into 5.6 m stair pands and 10 m window pands, and the 1923 types draw window +
  stair + window on each. A stair-only and a window-only variant are what the street needs.
- **Types (step 3)**: `transvaal-1911-five-storey` (low ground storey 3.35 m, Retiefstraat 45-75 + Pretoriusstraat
  72-120) and `transvaal-1911-five-storey-tall` (4.05 m, Transvaalstraat 3-47 + Retiefstraat 3-41), measured on 1 m
  gridded strips; facts cannot separate them, so auto-place runs with `--photo-decides` (batch.ts passes it through).
  The strip skyline reads dormer/gable/chimney tops and trees at 15.5-18.4 m on these rows, so the eaves criterion is
  3DBAG (12-16.4 m) plus bouwlagen 5; 3DBAG roof rise reads flat over the tile roofs (no roof criterion). Strip storey
  height (measureFacade `storeyM`) was tried and reads 2.9-3.5 m without separating the twins: not wired.
- **Kit (step 4)**: `resizePerStorey` remaps balcony storeys when a placement draws fewer storeys (tested; more storeys
  unchanged, roof-golden clean). Reused: `balconies` (projecting, centre axis), `tower` per-axis lights (wall dormer),
  `dormers` pointed + `dormerBody: stone`, `gable: point` + `atticWindows`, `windowSurround: stone-lintel`, `baysByWidth`.
- **Yield** (pands on the photographed faces): see the hand-back NUMBERS. Oost placed 15 after review (Retiefstraat 69C,
  71D, 73A; Pretoriusstraat 79-87; Paardekraalstraat 1-15 pair; Transvaalstraat 43B-45A; Transvaalstraat 42-48), none
  installed: every one of those runs fails the GLB audit with a 1.2-2.3 m2 brick/roof-tile coplanar overlap where a
  `point` gable stands beside a cornice/dormer neighbour (zfight-tight / geometry-regression). All-gable runs pass
  (Laing's Nekstraat 34-56 installed, then reverted at review: a flat-roofed block drawn with five gables).
- **Review holds** (`*-review-holds.json`): West Schalk Burgerstraat 18, 28, Maritzstraat 24-26; Oost Retiefstraat 51,
  53, 75A, Smitstraat 36A-38C, Transvaalstraat 54-56, 100A-102B, 124C-126A, Laing's Nekstraat 36-54B.
- **Crown choice is the weak point**: the skyline picks point gables on flat-topped fronts (Smitstraat, Transvaalstraat
  50-70 and 74-104, Laing's Nekstraat). A crown read that does not depend on clean sky is the next step, then the
  gable/neighbour roof overlap in the kit.
- **Strips for the user**: `staging/block-face/transvaalbuurt/round2/transvaalstraat-3-47-strip-over-model.png`,
  `staging/block-face/transvaalbuurt/round2/schalk-burgerstraat-2-140-strip-over-model.png` (untracked).
