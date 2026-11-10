# Nieuwmarkt/Lastage: Waterloopleinbuurt (AF09), Zuiderkerkbuurt (AF08), Nieuwmarkt (AF05), Rapenburg (AF04), 2026-11-10

Lane `lane/belt-nieuwmarkt-lastage-20261110`, MODEL: opus. Installed: **2 pands** (Rapenburg 97 and 99, run `rapenburg-89-103-r1`).
Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/nieuwmarkt-lastage-20261110/`
(`sheet-rapenburg-89-103-r1.png`, `strip-<face>.png` for every intaken face).

## Census (survey, BAG pands; register = `monument-facts.json`)

| buurt | pands | by 1945 | register | register gables | 1970-99 infill |
|---|---|---|---|---|---|
| AF09 Waterloopleinbuurt | 111 | 77 | 31 | cornice 12, bell 6, neck 6 | 17 (Jodenbreestraat, Waterlooplein) |
| AF08 Zuiderkerkbuurt | 279 | 225 | 105 | cornice 48, bell 18, plain 15, neck 14 | 37 (Verversstraat 10, Nieuwe Hoogstraat 6, Zwanenburgwal 6) |
| AF05 Nieuwmarkt | 233 | 176 | 78 | cornice 25, plain 20, bell 15, neck 11, step 1 | 54 (Recht/Krom Boomssloot 13, Keizers(dwars)straat 11, Snoekjesgracht 5) |
| AF04 Rapenburg | 125 | 88 | 28 | cornice 17 | 24 (Rapenburg 21, Prins Hendrikkade 6) |

* **BAG 1905 is a placeholder** on 109 pands (Zuiderkerk 43 vs 3 in 1900-04; Nieuwmarkt 49). New typed guard
  `match.unknownYears` (autoPlace.ts, test `nieuwmarktLastage.test.ts`, absent = byte-identical): a listed year neither passes
  nor vetoes. Both lane types list 1905.
* 240 proposed faces, 128 with two or more pands (626 pands). Intake so far: 23 faces (Rapenburg all except 75-87; the first
  Groenburgwal, Boomssloot, Jodenbreestraat faces). The rest is still running or not started (see integrator notes).
* The strips confirm the addendum: one design per pand, almost never a repeated row (Foeliedwarsstraat 40-88, Groenburgwal 2-30,
  Rapenburg 1-19 and 46-80 each show 5-11 different fronts). The 1981 renewal houses (Rapenburg 22-38) share a grammar
  (red-brown brick, one off-centre axis of cream-framed windows at split levels, a cream top band with a window ribbon, a cream
  entrance box) but the half-storey stagger between neighbours and the entrance box are not expressible; no type yet.

## Types (`scripts/block-face/types/nieuwmarkt/`)

* `lastage-cornice-house` (Rapenburg 97, gridded crop of the 2024-12-10 strip): white-painted ground storey 0-4.3 m as a `pui`
  ground front (door, wide window, door), three axes of white sashes (4.5-6.6 / 7.4-9.4 / 10.1-11.6 m), dark brown brick to 12.5 m,
  white attic frieze + cornice to 14.7 m (top storey carries the `frieze` cornice). Crowns frieze / dormer / none.
* `lastage-bell-house` (Rapenburg 99): white ground storey 0-4.8 m, three axes of small-pane windows 1.1 x 1.5 m, bell/neck gable
  12.4-15.0 m with one attic light. Derived from `jordaan-1750-neck-gable`.

## Yield (all intaken faces auto-placed with the library)

| outcome | pands |
|---|---|
| vetoed before comparison (year, frontage, every type) | most; the 9-15 m double fronts and post-1925 infill |
| compared and held (score < 0.7: tree skylines read crown rises of 6-11 m on Groenburgwal; likeness; run of one) | most of the rest |
| held by the lane (`rapenburg-review-holds.json`, `zuiderkerkbuurt-review-holds.json`) | 4 (Rapenburg 93, 95; Groenburgwal 2A, 4) |
| **placed and installed** | **2** (Rapenburg 97, 99) |

Totals by `-placement.json`: rapenburg 2/7, zuiderkerkbuurt 2/22 (both held now), nieuwmarkt 0/19, waterloopleinbuurt 0/13.

### What the Rapenburg 97-99 install needed (lane pins, the Opus review must confirm)
* `rapenburg-review-types.json`: 97 cornice house (edge NCC preferred the bell type on the window rows alone), 99 bell house.
* `rapenburg-review-eaves.json`: 97 at 14.7 m (cornice top; 3DBAG 11.6 m), 99 at 12.4 m (gable foot; 3DBAG 11.3 m).
* `rapenburg-review-accepts.json`: 97 floor 0.08, because the dark brick reads olive on the grey day and the likeness counted it as
  foliage (31 %), with no tree in front.
* Run intent edits: 99's shopfront white (the measured #3c3f36 was the glass), both bricks lowered (#3f342b, #3b2e25) so the render
  meets the photo wall (sheet: 99 ok, 97 hue -14 deg).
* Sheet by eye: window rows, white grounds and the bell outline line up. 97's second-storey windows are about 0.6 m short at the
  head (the 0.4 headLine floor of the top storey stops the split that would fix it). 97's sashes are drawn four-pane where the photo
  shows two-light sashes. 99's gable is a little wide at the shoulders. Its left house door stands in brick outside the white pui.

## Kit cannot yet say
* split-level (half-storey staggered) window axes between 1980s renewal neighbours, and their cream entrance boxes;
* the panelled attic frieze with a dormer over a two-window-storey cornice house (Rapenburg 95);
* white speklagen and block quoins on step and neck gables (Groenburgwal 2A, Nieuwmarkt 20-22; the register verdict already lists this);
* the white-painted ground storey that includes the house door (99): the residential door of a shopfront stands in brick;
* a top-storey window head under 0.4 of a storey that also carries a frieze;
* two bell fronts in one BAG pand (Rapenburg 5-7) need `modules` placement, not automated.

## Pipeline notes
* On tree-lined grachten (Groenburgwal, 2025-01-08 strips), the skyline reads bare branches as crown rises of 6-11 m.
  Every type is then held at score < 0.7, so these faces need crown pins or summer strips.
* `rapenburg-75-87` (seven 1981 houses at 4.2 m) fails intake: the sightline to Rapenburg crosses pand 181607 for every seed.
* `roof-golden.ts` reports 0 violations; `--write` would add about 280 other lanes' faces as well, so I did not write it.

## Checks
`npm run test:block-face` 337/337, `npm run lint` clean (before the report commit).

## Round 2 (2026-11-10): the Opus strip verdict applied (`docs/reports/rapenburg-strip-verdict-20261110.md`)

Reinstalled `rapenburg-89-103-r1` (all gates pass, GLB audit clean). The sheet is re-archived in source-data as
`sheet-rapenburg-89-103-r1.png`. By eye, the overlay now lines up row for row on both pands.

* **97 (type `lastage-cornice-house`):**
  * window rows at 4.5-6.6, 7.1-9.2 and 10.1-11.6 m;
  * two-light sashes on storeys 1-2 (`storeyWindows`), the cross window kept on top;
  * flush `full-frame` surrounds in place of the projecting sills;
  * a 2.2 m white `entablature` (frieze and cap) in place of the 1.6 m frieze cornice;
  * brick `#483f32`.
* **99 (type `lastage-bell-house`, crown pinned `bell` in the run):**
  * neck `crownNeckWidth` 0.37 (about 2.1 m) under a `rounded` cap, `crownShoulderRise` 0.45, `crownRise` 1.1;
  * window heads raised (0.93 / 0.94);
  * the gable light 1.0 m wide and 0.75 m lower, with no hoist;
  * brick `#45372a`;
  * a full-width white `pui` ground front: two doors at the left, a 2.5 m four-light shop window, and one transom row.
* **Kit additions** (typed, validated, tested in `nieuwmarktLastage.test.ts`, byte-identical when absent;
  `test:building-recipes` 494/494, `test:block-face` 339/339):
  * `FrontIntent.atticLight {light, sill}`: a measured gable light width and its sill over the crown foot;
  * `GroundFrontIntent.bayWeights`: measured bay widths, reversed on mirror;
  * `GroundFrontIntent.transom`: door heads and window transom bars on one line;
  * `GroundFrontIntent.lights`: mullioned lights per window bay.
* **Still not drawn:** the round cap is the neck width, not the narrower 1.45 m sandstone cap. The claw scrolls, the frieze vent
  and the finial are not drawn either.

## Round 3: per-pand batch fit pilot (2026-11-10)

`scripts/block-face/pand-fit.ts` (typed core `src/canalRecall/blockFace/pandFit.ts`, tests `pandFit.test.ts`) drafts one inline
house type per pand from its own strip span and lets the gates decide:

- **Storey lines and window rows:** `typeDraft.ts` `storeyProfile`.
- **Bays:** the photo's window columns, or else the frontage width.
- **Door side:** `auto-place.ts` `doorSide`.
- **Ground storey:** a white pui (ground-band accent ≥ 35 %), a trading pui, or a house door.
- **Crown:** the register gable (`monument-facts.json`) or else the skyline crown. Gabled pands are refined at compile time through `continuity.crownFromPhoto`.
- **Frieze:** an entablature when the gap over the top window row is ≥ 0.8 m.
- **Palette:** measured.

**Execution:**

- Runs of consecutive drafted pands become `<face>-pf<k>`, and a single pand becomes a `lonePand` face.
- Each run goes through `compile.ts` and the likeness gate. A pand that fails drops out and the run is recompiled once.
- Output is a CSV/JSON of pand → measured fields → result in `staging/pand-fit/`.

**Changes to the kit and readers:**

- **Kit:** none.
- **Skyline reader:** gained an opt-in `brightSky`, because the Rapenburg strips' over-exposed tinted sky (#f8fde9) read as building: 0 of 9 skylines on rapenburg-20-44, 6 of 9 with the option. Absent, its output is unchanged.

**Pilot:** 8 faces: rapenburg 1-19, 2-18, 20-44, 21-73, 46-80 and 89-103, peper 2-8, and foeliedwars 40-88. That is 54 pands; 97 and 99 were skipped as already installed. The Oudeschans strips are not taken yet: they come later in the running intake, and per the brief I started no new intake.

| result | pands |
|---|---|
| storey rows unread (no window contrast 6, one window run 9, implausible profile 3) | 18 |
| frontage outside 3–9 m (1980s renewal blocks and warehouses, not one-offs) | 14 |
| blank front > 2.6 m over the top window row (roof storey or skyline on a dormer) | 6 |
| storey heights implausible (merged or split rows) | 9 |
| compiled, failed likeness (NCC 0.14, 0.12, −0.05) | 3 |
| compiled, failed storey-height gate | 1 |
| skipped (installed) | 2 |
| **passed the gates** | **1** |

- **Install rate:** 0 of 52 installed. The one pass (Foeliedwarsstraat 62, NCC 0.32) is held on the sheet:
  - its brick is far lighter than the photo;
  - the dentil frieze is missing;
  - the ground is a door and windows where the photo shows a glazed pui.
- **Time:** about 0.4 s per pand to measure and draft, and about 10 s to compile each run. The 54 pands took 17 s of wall time in all.
- **Sheets** are in `map-recall2-source-data/block-face-strips/nieuwmarkt-lastage-20261110/pand-fit-pilot/`, along with the CSV and JSON. Only 4 runs compiled, so there are 4 sheets, not 6.

**What the sheets show:**

- The storey reader mistakes a ground shop pui plus two window rows for three window storeys: Foeliedwarsstraat 50B and 40C.
- The skyline crown labels a spout or pointed gable a bell: 40C.
- Stitched, ghosted strips give no usable rows: rapenburg-21-73 on its left, rapenburg 2-18.

**Scaling view for about 6,000 belt pands:** this does not scale yet. The cost is negligible: about 1 hour of CPU for 6,000 pands. The yield, though, is about 2 % gate passes and under 1 % that look right. The bottleneck is reading the front, not drafting or compiling:

1. The storey/window-row reader is tuned for repeated brick rows. On belt fronts it fails or misreads about 60 % of pands: shop puis, transoms, stitched strips, and white surrounds on stucco.
2. The crown kind needs the register for every pand. The skyline guess confuses spout, bell and dormer.
3. The likeness gate is the right referee: it held every bad draft. But a pass is not the same as a good look; brick tone, friezes and ground puis still need a human eye.

Before a belt-wide run, it would be worth it to:

- read storeys with the ground pui handled separately (detect the pui band first, then window rows above it);
- take the crown kind only from the register, or hold the pand;
- require a palette delta under a threshold as a gate.

Until then, per-pand authored fronts (like Rapenburg 97/99) remain the route for the one-offs.

### Round 3b: reader iteration (same 54 pands)

Changes:

1. **Ground band first** (`typeDraft.ts` `groundBandTop`): the lowest run of opening rows that starts under 1.6 m. Its head (2.2–5.5 m) sets where the upper window rows are read from (`storeyProfile` `fromM`).
2. **Crown kind from the register only** (`gableFor`): a skyline crown with no register gable is held.
3. **Colour gate:** the review's wall-colour check (`wallColour.ts`, model against photo on the same pixels) holds a pand that fails it.
4. **Stitch doubling** (`typeDraft.ts` `columnAlignment`): the median correlation of window columns across storeys, read on the middle 60 % of each window run, is held under 0.1. The cell mask is noisy: clean Foeliedwarsstraat 62 reads 0.25, while the mosaic pands on rapenburg-21-73 and Rapenburg 33 read −0.2 to −0.37. So the bar catches mosaics, not irregular fronts.

All four only apply when `pand-fit` asks for them (`measureFace` `groundFirst`). The kit is untouched.

| | round 1 | round 2 |
|---|---|---|
| passed the gates | 1 (Foeliedwarsstraat 62) | 1 (Rapenburg 34) |
| looks right on the sheet | 0 | 0 |

- **Foeliedwarsstraat 62** is now held by the colour gate (too grey and too dark), which matches the reviewer's eye.
- **Rapenburg 34** passes the gates (likeness score 0.156, just over the 0.15 bar) but does not look right. It is an asymmetric 1980s front with one window stack and a framed attic band, and it is drawn as a symmetric two-bay front with a white frieze. Held.

Top remaining hold reasons (round 2):

| hold reason | pands |
|---|---|
| storey rows unread (no window contrast or a single window run) | 18 |
| frontage outside 3–9 m | 14 |
| crown kind unknown (no register gable) | 5 |
| window columns do not stack (stitch-doubled) | 5 |
| storey heights implausible | 4 |
| blank front over the top window row | 3 |
| ground storey implausible | 1 |
| wall colour | 1 |
| skipped (installed) | 2 |

The ground band is read on only 13 of the 54 pands: trees, bikes and cars in the bottom 3 m leave the mask unusable there.

**Verdict:** still 0 % look right, far under the 15 % bar, so I stopped as briefed. The gates now hold every bad draft, but the strip reader cannot recover enough of a belt front to draft one:

- 18 pands give no usable storey rows at all;
- 14 are not single-house fronts.

Per-pand fitting at belt scale needs a better facade reader (per-window detection rather than row and column shares on a colour mask), not more drafting rules. Authored fronts stay the route for the canal-belt one-offs.
