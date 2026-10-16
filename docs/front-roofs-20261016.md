# Roofs follow the front, gables are symmetric, rows are coherent (2026-10-16)

Kit rules lane, branch `lane/kit-roof-rules-20261016`. Three user rules, verbatim:

1. "don't give so much credence to 3DBAG roofs"
2. "stepped gables are almost universally symmetric, you keep making this mistake"
3. "you probably could have guessed that one house here isn't higher than the rest"

Likeness to the photo is the acceptance bar; every gate below is a guard, not the bar.

## What was wrong

- **Lopsided step gables** (Kinkerstraat 56-84: 236441, 236325, 161359). Two causes. The crown outline the kit draws
  (`canalhouseCrownProfile('trap')`) was itself asymmetric: the right-flank loop ran one tread late, so the crest
  gained a tread on the right and the eaves-level tread was lost; every step gable in the library (block faces and the
  city tier alike) leaned by one tread width (0.38 m on Kinkerstraat 68). On top of that, LoD2.2 roof planes above the
  outline showed through `crownVerges` as roof-coloured wedges on one side.
- **3DBAG as the roof** (rule 1). `survey` pands kept LoD2.2 planes that read the flat top of a mansard, a rear roof
  carried to the facade, or a chimney as the roof; `recipe` pands used 3DBAG p95 as the attic cap and nothing else.
- **One house higher than the rest** (rule 3). On Kinkerstraat 315-359 (18 pands of one type, 1903) the LoD2.2 eaves
  split into 12.9-13.9 m (the cornice) and 14.5-16.1 m (the mansard's flat top); the lane had hand-measured eight pands
  with `measuredEaves` to fix it, and the bell gable at 343 crowned at 18.6 m. Kinkerstraat 359's roof max stood 0.9 m
  over its row.

## Rules now in the kit

### Roof source per pand (`roofSourceFor`, blockFace/compile.ts)

`roof.source` on the house (`3dbag` keeps LoD2.2, `front` follows the front), a `keepSurvey` entry keeps LoD2.2;
otherwise the roof follows the front as soon as a street front carries a measured crown: a gable or a measured eaves
line (strip or row). Cornice fronts, capped or plain, keep the face rule (`recipe` or `survey`): a wide cap is a
parapet on De Clercqstraat with 1.5 m of roof behind it and a cornice band under a steep roof elsewhere, so it says
nothing about the roof (a first cut made parapets flat and z-fought the Amsterdam School neighbours' flat roofs). Classes in `scripts/block-face/roof-golden.json`: `survey`, `recipe`, `front`, `+row` when the row rule
clamped the pand, `+mate` when a cornice-group mate turned front (the group's shared attic line moved with it).

### Front forms (`frontRoofSpecs` -> blockFace/recipeRoof.ts `FrontRoofSpec`)

Per street front band of a `front` pand:

- **saddle** under a gable's crown outline (`saddleUnderProfile`): the ridge at the band centre, 3 cm under the outline
  everywhere, pitch 30-65 degrees (or `roof.pitchDeg`), two planes over the main body, flat skirts at the saddle's side
  eaves beyond the band's own front (Kinkerstraat 64-66 wraps behind its neighbour). When the crown spans only part of
  the front (a step gable over one bay of a wide front) the saddle's side eaves would drop over a metre under the
  cornice: an attic face instead, with the reason in the report.
- **attic** face behind dormers or a `frontRoof` hint (the hint's top row and pitch; 3DBAG max stays the bound), and the
  3DBAG-bounded attic for the rest, which goes flat by itself when 3DBAG stands under a metre over the eaves (a
  measured cornice says where the cornice is, not that nothing rises behind it). A row ridge caps every attic band.
- **flat** only when `roof.form: flat` forces it.

`frontRoof` on a `measuredEaves` entry is a hint now, not a precondition (the "survey roof above the measured eaves"
throw is gone).

### Gates (front pands)

- `height-vs-3dbag` (front variant): roof max <= the crown line + 0.3 m (dormers +1.9 m) and >= the front eaves, the
  crown line being the highest of the band lines and every street front's crown outline top (a tower on a cornice,
  Bilderdijkstraat 133; a dormered cornice beside a bell gable, Oudezijds Achterburgwal 177943); 0.3 m for what stands
  on the outline (a cap, a finial, the cladding over a crown plate). 3DBAG is an upper bound only.
- `roof-under-crown`: along the facade line, every 0.1 m, 5 mm inside, the roof stays under the crown outline
  (<= 3 cm above). A wrong eaves (a bad row line) surfaces here as dormers standing on a flat band.

### Body eaves under a saddle (buildingRecipe/fit.ts, guarded)

For `roofSource.kind === 'front'` the body eaves drop to the lowest roof edge along the front (sampled 5 cm inside), so
the crown plate fills the facade from the saddle's side eaves up to the outline; other pands are untouched.

### Symmetric step gables

- `canalhouseCrownProfile('trap')`: the right flank mirrors the left exactly. Changes every step gable in the library:
  `scripts/building-recipes/fit-golden.json` re-recorded for the five step-gable houses (bilder-155418, 156286,
  156287, cw-heren-175702, 179665); the city-tier pilot golden (`tileBuildings/pilot-golden.json`) was already stale
  against the current source pack (it gained a large pand and every canal house's triangle count moved), so it was
  left for the integrator to re-record (`UPDATE_GOLDEN=1`).
- `stepsFromFlanks` (blockFace/gableFromStrip.ts): one step count for both flanks, the mean of the two photo readings;
  when one flank is read under 70 % (a tree, a wire, a neighbour's roof) the better-read flank's count wins (an occluded
  flank loses plateaus, never gains them). `PhotoGable.flankCoverage` carries the two coverages.

### Row coherence (blockFace/rowCoherence.ts)

A row: consecutive houses placing one type, built within two years of the run's modal year, three or more. Its
cornice is one line and its roof one ridge.

- The row line: the median of the strip measurements when at least half the members carry one (one measured member is
  its own evidence: Kinkerstraat 224 is the one house of its row with an attic storey); else the mode of the unmeasured
  members' 3DBAG eaves, every street front a sample: the densest 0.4 m window, and of the windows holding at least 70 %
  of the densest's samples the lowest (a misread is upward), refined by mean shift. Single linkage would chain the
  315-359 cornice readings into the flat-top readings through a 0.7 m gap; a full-width window landed between the two
  genuine lines of Kinkerstraat 206-242.
- Sub-rows: three or more adjacent members whose 3DBAG eaves agree within 0.15 m keep their own line (Kinkerstraat
  222-228 stands 0.6-0.8 m over 212-220, one type and year). A pair is not enough (319-321 are two adjacent misreads).
- Clamp: a member more than 0.8 m off its line, not strip-measured and not confirmed by its photo skyline within
  0.4 m, takes the line as `measuredEavesM` (per street front, tagged `rowClamp`); a roof max more than 0.2 m over the
  row's median ridge is capped at the ridge + 0.1 m (survey vertices clamped, heights follow). Every clamp is in the
  report (`rowClamps`), on the compile log and on the sheet.
- `continuity.rowCoherence: false` switches the rule off (byte-identical); `{thresholdM}` tunes it.

## Regressions pinned

- `gableSymmetry.test.ts`: library outlines mirror within 1e-6 (every type, 1-6 steps, caps, shoulders);
  `stepsFromFlanks`; `saddleUnderProfile` under every type with the ridge at the centre; every compiled gable outline on
  the six faces mirrors; Kinkerstraat 56-84: 236325 m0/m1, 236441 m2, 161359 m0 are front/saddle, roof heights at
  c +- t equal within 2 cm, `roof-under-crown` passes, no roof z-fight > 5 dm2 at party lines, the flat infill 152566
  keeps its LoD2.2 planes.
- `rowCoherence.test.ts`: the kinker-315-359 regression (below), plus unit rules.
- `roofSchema.test.ts`: `roof.source/form/pitchDeg/evidence`, placement roof override, `continuity.rowCoherence`.
- `recipeRoof.test.ts`: front forms partition every pand footprint on the six faces (<= 2e-4 m2).
- `roofGolden.test.ts`: survey/recipe pands compile from the recorded facts; reclassified pands are listed.

## Measured results on the six faces

Before sheets: `staging/block-face/<face>/review-before/strip-sheet.png`, after: `review-after/strip-sheet.png`
(GLB sha256s in `staging/block-face/{before,after}-sha256.txt`). All six: gates pass.

- **kinker-56-84**: step gables symmetric; saddles behind 158903, 161359 (m0 65 deg, m1 59.5 deg), 236325 (m0/m1
  65 deg), 236441 (m2 65 deg, m3 48 deg; m0/m1 70 deg attic faces to the 3DBAG p95); row (kinker-1886-neo-renaissance,
  4 members): 161359 m0/m1 eaves 12.69/12.58 -> 13.87 (the photo's one cornice line), 236441 m0 15.52 -> 13.87, roof
  maxes 17.56/17.3/19.1/18.59 -> 17.09.
- **kinker-315-359**: the eight hand entries removed; the row rule clamps exactly {156907, 165777, 153818, 153447,
  159990, 236156, 167386, 236481} plus the neck-gable module 237373/m2 (15.72 -> 13.49; its two dormer modules read
  the cornice), row line 13.49 (hand measurement 13.5), 080487 (1987 infill) excluded, 343's cornice on the line and
  its crown within 0.1 m of 345's, 359's roof max 16.86 -> 16.03.
- **kinker-65-87**: ten front roofs (attic 30 deg per the face pitch; 236453 m0 saddle 43.6 deg under its neck gable).
- **kinker-206-242**: `keepSurvey` dropped (face rule recipe). Painted-band row: the two neck gables 237297 and 152992
  eaves 14.52/14.67 -> 12.64 (gable shoulders on the cornice, as photographed), 165141 roof max 17.13 -> 14.76,
  152992 16.12 -> 14.76. Plain-brick row: 222-228 is a sub-row on 14.0 m, 162560 roof max 16.89 -> 16.55, 236982
  18.26 -> 16.55; 236982's eaves (12.44, 0.77 m under its line) stays: under the threshold.
- **bilder-081118-155417**: step gables 156287/156286/155418 symmetric with 70 deg attic faces capped under the crown;
  157650's step crown over one bay stays an attic-turned-flat band (3DBAG p95 0.3 m over the eaves).
- **bilder-236022-167243**: 159868 point gable saddle 60.9 deg; 236711 step gable symmetric; the point/neck crowns of
  162572/237294/236474/167243 over part of their fronts take 70 deg attic faces.

Roof golden diff (`scripts/block-face/roof-golden.json`, 46 faces / 371 pands): 139 unchanged; 83 recipe -> front,
77 survey -> front, 32 survey -> front+row, 12 survey -> survey+row (LoD2.2 vertices capped at the row ridge),
8 survey -> recipe (kinker-206-242, keepSurvey dropped), 7 recipe -> recipe+mate, 7 recipe -> recipe+row,
3 recipe -> front+row, 3 survey -> recipe+row. No same-class hash changes (every survey/recipe pand compiles from the
facts it did before).

## What the kit still cannot say

- A saddle only when the crown spans (nearly) the whole front: a step or neck gable over one bay of a wide front gets a
  70 deg attic face behind it, not the hip-and-gablet or the cross-gable the photo often shows (bilder-081118 157650,
  bilder-236022 162572/237294/167243, kinker-65-87 106015/156997).
- The attic face behind a plain cornice is still 3DBAG-bounded (p95 cap); when 3DBAG reads the cornice as the top the
  band goes flat under its dormers (the `height-vs-3dbag` gate catches the gross case).
- A row member 0.5-0.8 m off its line stays (236982 on 206-242: visibly lower than its three Action-block neighbours);
  genuine half-storey differences within one type run are not separable from misreads by threshold alone, only by a
  photo skyline, which the row rule accepts but no face supplies yet (`photoGables` readings are a separate lane).
- The row ridge cap does not apply to a saddle under a measured gable (the crown line bounds it): a gable's crown
  height still comes from the type's `crownRise`, not the photo.
- 236441 m1 (Kinkerstraat 58-60, a cornice module between two gables): the 3DBAG-bounded attic rises 2.4 m at 70 deg
  behind it; the photo shows a lower roof there.
