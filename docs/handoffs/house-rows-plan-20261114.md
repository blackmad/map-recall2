# House line: rows first (review and plan, 2026-11-14)

For the Opus integrator (`integrator-lanes-85`) and every house lane it spawns. Written by the Fable review
session after David rejected the D1 ring and belt results. David approved this plan on 2026-11-14. It
replaces the per-building D1 tranche plan of 2026-11-13 and lifts the belt pause on the terms below.

## David's words and decisions

- On `ui/2026-11-14-d1-ring/kinkerstraat-da-costabuurt/r2-rule10-1.jpg` (screenshots repo): "this is awful",
  "combines two houses, misses that they all have identical roof lines and are basically identical, might
  as well be random", "invents roof, misses details", "terrible!".
- On `ui/2026-11-14-d1-wall-colour/round2/weteringschans.jpg`: "where did the pointy roof come from here?"
- On the cause: "why aren't we doing these along with neighbors?"
- **The 293 live fronts (batch 1, 36182f238)** come off in the same round that ships the first redone rows.
  That round restores every batch-1 front it does not redo to its pre-D1 look. No separate revert round.
- **Sign-off:** David approves the first row of each kind (per buurt or house type): a sheet and a ping.
  After his OK, more rows of that kind publish on `check:rows` and the blind row review, sheets on #68.
  A new kind always goes to him first.

## What went wrong

Traced on Kinkerstraat 86–110 (even side, 1893) and Weteringschans 168096–171218. Items marked
(inferred) were read from code or timestamps, not reproduced: confirm before fixing on them.

1. **The reading was mostly right; staging threw it away.** `artifacts/describer-d1/ring-20261114/answers/`
   has every house in the row as brick, 3 bays, 4 storeys, bracketed cornice, one gabled dormer, `sameAs`
   both neighbours. `scripts/house-specs/describer-d1/stage.ts` (`STAGED`, lines 38–59) keeps storeys,
   bays, flat heads and a `cornice` crown. Dormers are held on every route (`spec.ts` `SPEC_HELD_READS`),
   cornice kind is dropped, `windows` is never set, surrounds and sills are not staged, `sameAs` is not
   written to the spec (it only feeds a guard that copies storeys, gable and bands into fronts that lack
   them, at confidence 0.35, below the 0.5 the crown needs), and the no-brick variant has no wall colour.
2. **What is not staged is filled per building by hashes.** Roof kind and gable shape are
   `hash01(id:roof)` and `hash01(id:gable)` in `roofMesh.ts planRoof` (for a 1880–1910 house about step
   38 %, neck 29 %, cornice 21 %). The cornice lid's height comes from that pand's own 3DBAG height and
   footprint width. The bay preset is `hashSeed(id)` (`bayLook.ts`), wall colour without a hex is a
   per-pand pick, and extras are dice per pand and wall (`facadeExtras.ts`, `facadeOrnaments.ts`: iron
   balconies 0.6, flower boxes 0.25, quoins 0.3, bay window 0.2, oriel 0.08). A spec only adds forced
   parts. 159635, 152925 and 160809 have identical staged designs and draw one red and two tan, with
   tops between 14.5 and 16.9 m.
3. **Pointy roof.** Weteringschans 169016 was read as "slate mansard, one pedimented dormer with a hoist
   beam". `stage.ts:47–51` drops every mansard answer (benchmark precision 0.33) and `roofFront` is not
   staged, so the spec has no crown and the roof is the hash roll (probe: `crown point, roofKind pitched`).
   A `cornice` reading draws the cornice branch of `buildRoofTriangles` (`roofMesh.ts:735–753`), which
   returns before any dormer call. A spec cannot ask for a mansard.
4. **"Combines two houses".** 0363100012236027 is Kinkerstraat 106–108 (two numbers, 8.8 m;
   `scripts/street-surveys/streets/kinkerstraat.json`). The reader counted 6 bays and answered
   `extent: single`. The centre glazed strip is also in "today": the oriel or bay-window dice (inferred).
5. **The row was already described in October.** `scripts/block-face/faces/kinker-86-110/intent.json`: one
   row of `kinker-1890-plain-brick`, 3 axes on ~5 m, consoled cornice measured at 14.2 m ("3DBAG
   16.9–17.1 m reads the mansards"), a pediment dormer per house, red-brown, three head variants, 106–108
   and 92–94 as fronts m0 and m1. 310 face intents exist: 1,402 pands, 135 types, 570 measured cornice
   heights; Kinkerstraat 208 of 208 pands; 960 more face directories have strips and no intent. D1 neither
   used them nor was checked against them.
6. **The row-front path was not used.** `src/canalRecall/houseLine/rowFront.ts` (merged round 130, flag
   `?rowFront=1`, records in `public/data/front-records/row-front.json`, Haarlemmerdijk only) draws a
   front at its measured top with a lid or a measured crown, sub-fronts for two fronts in one pand, a
   `row-line` fallback from measured neighbours and the `ROW_FRONT_EXTRAS` allow-list. Batch 1 went
   through the hash path.
7. **The unit was one building.** `describe-cut.ts` shows one neighbour each side; prompt v4.3 says "never
   describe a neighbour". Fields were gated on single-house benchmark precision, so a roof read alike by
   ten houses of one series was still dropped.
8. **The sheets could not show a row.** `ring-frame-lists.ts` orders both street sides on one axis and the
   12-cap list takes every other front. The sheet photo is `pickLikeness`'s capture, not the one the
   reader saw (the scaffold on 160809 is only in the sheet photo). 236213 was read through scaffold
   netting with `readable: true`, and its W1 colour `#243142` is the netting.
9. **Belt.** By the lane's own verdicts 21 of 26 pages were same or worse (near-black fronts); the five
   "better" pages were published. Poses are across the canal at 40–60 px a house, behind trees and vans,
   with many "no frame" panels.
10. **The bar and the pace.** "Closer than today" passes almost anything. Five staging variants (w1,
    nobrick, r2, wall sample v2, judged colour) sat on the same readings in one day; 1,926 fronts were read
    before one row looked right. The D1 plan lived in messages: no brief in `docs/handoffs/`.
11. **The plan's own faults (Fable, 2026-11-13).** The building as the unit, row descriptions parked as an
    outside-the-belt follow-up, "draw, never average" for neighbours, and single-read precision as the
    staging gate. Items 1, 2 and 7 follow from those.

## Rules for every house lane

1. **The row is the unit.** A house is a member of a series. A series has one design and one set of lines
   (cornice, storeys, window cell, wall family, roof).
2. **Unstated never means dice.** A described row draws only what its description or type states. An
   unstated field takes the series value, else a plain period default: cornice lid at the row line, the
   row's wall family, plain tall windows.
3. **No silent drops.** A read field is drawn, settled by series consensus, or printed on the sheet as
   "read, not drawn" with the reason.
4. **Use what exists before reading anything new:** face intents, street surveys, type libraries, the
   1,926 D1 answers.
5. **Likeness on the whole row is the bar,** judged by someone who did not build it. "Closer than today"
   is retired. One row, then one street, then ten. No tranche before a row of that kind has passed David.
6. **Progress is rows that pass,** not fronts read or staged. Staging variants are not progress.
7. **Plans are files.** Each lane gets a brief in `docs/handoffs/` and an issue.

## Lanes (three at most on this goal)

The integrator owns merges, the world compile, `TODO.md`, `HISTORY.md` and pushes. Lanes work in their own
worktrees and iterate in Node; the browser queue is for the final frames.

### Lane D: row records (opus)

New typed module `src/canalRecall/houseSpec/row/`, script `scripts/house-specs/rows/`, `npm run house:rows`.

- **Row record** per street side: members in street order, multi-number pands split into fronts, series
  (runs of one design). Inputs: `scripts/street-surveys/streets/*.json` (label, numbers, units,
  frontWidthM, built); block-face `intent.json` (`types`, `houses[].type`, fronts m0/m1,
  `continuity.measuredEaves`, `identical`, `corniceGroups`); D1 answers under `artifacts/describer-d1/`
  (`sameAs` chains, bays, storeys, storeyParts.roof, dormers, crown, cornice, heads, finish); register
  facts.
- **Row solve:** per series the mode of each class field and the median of each metre field. A member
  differs from its series only on per-house fields (ground use, door side, paint) or when two readings
  confirm the difference. Precedence: reviewed > face intent > series consensus > single read > period
  default. A class disagreement between a face intent and the D1 consensus flags the row for a second
  look; it is not resolved silently.
- **Output:** `RowFrontRecord`s for `houseLine/rowFront.ts` (`subFronts` for two-number pands) and
  HouseSpecs through `houseSpec/fromFace.ts`, with a per-row report: source of each field, members
  overruled, fields read and not drawn.
- **Scores:** D1 series consensus against the face intents on Kinkerstraat's 208 pands, per field. This
  replaces single-house precision as the staging gate.
- **Wall colour:** one family per series from the type palette or the reader's words, through the
  11-family palette in `judgedColour.ts` (`lane/d1-colour-judged-20261114`, code only). No sampled hex.
- **Not staged:** any front whose reading mentions scaffold or netting over the upper storeys.

### Lane R: renderer (opus)

Sole owner of `houseLine/rowFront.ts`, `roofMesh.ts`, `houseSpec/decorate.ts`, `facadeExtras.ts`,
`facadeOrnaments.ts`, `bayLook.ts` while it runs. Every described house draws through the row-front path.

- **Row front for any pand with a row record:** wall top at the series cornice line (never the pand's own
  3DBAG height); extras from `ROW_FRONT_EXTRAS` plus what the type states; one bay preset and one wall
  family per series, seeded by the series id.
- **Roof storey behind a cornice:** a mansard face in slate with N dormers per front (gabled, pediment,
  plain; hoist beam optional) from `roofStorey` and `readDormers`; a flat lid otherwise.
- **No hash roof on a described house:** a member with no crown takes the series roof; a lone described
  house takes a cornice lid at its front top.
- **Head dressings per row** (`rowHeads`: block course, keystone, dentil lintel, segmental tympanum) and
  the tall window cell. The white heads are what makes these rows recognisable.
- **Belt crowns** at the measured top through `houseLine/crownProfile.ts` (neck, bell, step, spout,
  cornice with a centre attic window).
- Byte-identical for a pand with no row record. Report triangles and bytes per row.

### Lane P: page and gates (sonnet for tooling; fresh opus agents review)

- **Row strip sheet** (`npm run house:row-sheet`): the photo strip (the captures that were read) over the
  drawn strip (Node, same scale) over this morning's. One street side, consecutive, every front. Reuse
  `scripts/block-face/ortho-compare.ts`, `review.ts` and `scripts/house-preview`. Rule-10 frames follow
  for rows that pass: one side per list, the photo column is the reader's capture.
- **`check:rows`** in Node, added to `check:canal:rest`:
  - members of a series resolve to one design (allowed per-house fields listed);
  - cornice step inside a series ≤ 0.2 m;
  - no extra outside the allow-list on a row member;
  - no hash roof on a row member;
  - every read field is drawn, settled or reported.
- **Named regressions:** Kinkerstraat 106–108 (0363100012236027, two fronts); 104, 102, 100 (159635,
  152925, 160809: identical); 92–94 (236213: scaffold read, nothing staged from it); Weteringschans
  0363100012169016 (mansard with dormer, no pointed gable).
- **Blind row review:** a fresh agent gets only the two strips and answers in visible order, pass or fail
  with the house number: same houses drawn the same; roof line; colour family; roof storey and dormers;
  window rhythm and white dressings; anything invented. A fail in the first three blocks the row.
- **Doc step:** `docs/house-line.md` gets a "Rows" section (records, solve, gates, sheet), and `CLAUDE.md`
  a short "House rows" paragraph carrying rules 1–5 above. A lane without its doc diff is not done.

## Rounds

1. **The flagged rows, and batch 1 comes off.** Kinkerstraat 86–110 and Weteringschans 168096–171218
   from the existing face intent and D1 answers. On the strip: one cornice line at about 14.2 m across
   110–90; 106–108 and 92–94 as two 3-bay fronts each; red-brown brick throughout; a dormer per front on
   a slate mansard; the three head variants; no balconies, flower boxes or centre strip. Weteringschans:
   two cornice fronts and two mansards with pedimented dormers. The same round restores every other
   batch-1 front. Sheet to David with a ping; nothing further publishes before his answer.
2. **Kinkerstraat, all 28 faces, 208 pands, no new reads.** Posts the consensus scores.
3. **The other typed faces** (about 280 faces, 1,200 pands: De Pijp, Bellamy, Frederik Hendrikbuurt,
   Nassaukade, Jordaan and others), a buurt at a time. The first row of each buurt or type goes to David.
4. **Ring tranche** (950 staged reads), row-solved from `sameAs` chains and surveys. Where the consensus
   is weak or there is no face intent: a row reader, one opus read per face strip, returning the series
   partition, one design per series, the exceptions and a colour family per front. No per-building
   tranche reads again.
5. **Belt** (about 1,000 fronts), started beside round 2:
   - row strips from quay-side winter captures for the Herengracht and Keizersgracht units;
   - one row read per about 8 fronts: crown class, colour family judged within the one image, height
     relative to the neighbours, twins; the 851 belt reads keep their bays and storeys unless the row
     read disagrees, which triggers a second read;
   - crown profiles and a cornice lid when no crown is read; no sampled near-black walls;
   - first belt block for David: Herengracht 2–90.
6. **City-wide, behind a flag until David has seen a 30-row sample sheet:** seed the roof, preset and
   colour hashes by row (same build year ±2, adjacent, like height) so an undescribed series draws alike,
   and replace the step and neck odds with crown frequencies measured per buurt and year band from the
   typed faces and the D1 reads.

## Stops

- Per-building D1 tranches and restages.
- Staging variants and colour-sample lanes (w1, nobrick, r2, wall sample v2 and later).
- Single-read precision as a staging gate.
- "Closer than today" verdicts.
- Publishing any described house through the hash path.

## Verification

- Round 1 is done when both strips pass the blind review and David, `check:rows` and its named
  regressions pass, and rule-10 frames of the same rows (72°, dpr 2, own engine, compiled world after
  `world:compile --changed --no-policy --shell`) agree with the strips.
- `npm run test:house-spec`, `npm run lint`, `check:rows`, then `npm run check:canal` before a push;
  covers and frontages re-baked after installs.
- Every round reports rows passed, rows blocked and why, and fields read and not drawn.

## Evidence

- Sheets: `ui/2026-11-14-d1-ring/`, `ui/2026-11-14-d1-belt/` (README has the verdicts),
  `ui/2026-11-14-d1-wall-colour/round2/` in `blackmad/map-recall2-screenshots`.
- Readings: `artifacts/describer-d1/ring-20261114/answers/`, `answers-ah07/`, belt verdicts in
  `_pruned-sheets/`.
- October rows: `scripts/block-face/faces/*/intent.json`, `docs/kinkerstraat-types-20261014.md`.
- Renderer: `src/canalRecall/roofMesh.ts`, `houseLine/rowFront.ts`, `houseSpec/decorate.ts`,
  `facadeExtras.ts`; `docs/house-line.md` "Not wired" and "Spec fields on route A".
