# Kalverdriehoek (AD08) and BG-terrein e.o. (AE05), 2026-11-10

Lane `lane/belt-burgwallen-20261110`, MODEL: opus. Census, per-house hand-authored historic designs, sheets, and 9 installed faces (23 pands).
Kop Zeedijk (AE01) and Burgwallen-Oost (AE03) were surveyed only (`scripts/block-face/buurten/{kop-zeedijk,burgwallen-oost}.json`); no faces were authored there.
Sheets and strips:
`/Users/blackmad/Code/map-recall2-source-data/block-face-strips/kalverdriehoek-20261110/` and `.../bg-terrein-20261110/` (`sheet-<face>.jpg`, `strip-<face>.jpg`).

## What the buurten are
| buurt | BAG pands | register gables (cornice / neck / step / bell) | survey faces |
|---|---|---|---|
| AD08 Kalverdriehoek (Kalverstraat, Rokin, Spui, Heiligeweg, Singel 413-445) | 131 | 24 / 20 / 3 / 2 | see `kalverdriehoek.json` |
| AE05 BG-terrein e.o. (Oudezijds Achter- and Voorburgwal, Kloveniersburgwal south, Grimburgwal, Doelenstraat) | 189 | 47 / 15 / 0 / 7 | see `bg-terrein.json` |
| AE01 Kop Zeedijk | 261 | survey only | 81 |
| AE03 Burgwallen-Oost | 423 | survey only | 90 (14 already on a face) |

Most of the fronts are 17th-18th-c. one-offs with rebuilt shop ground storeys. Repetition is near zero, so the lane authored each house as a
historic `design` (the precedent of `wallen-oza-41-57` and `nassau-145-152`) from a 40 px/m grid crop. It did not auto-place house types.

## Installed (each sheet reviewed against the photo; every gate, interference check and the GLB geometry audit passes)
| face | pands | what it is |
|---|---|---|
| `kalver-182-186` | 176134, 176136, 176135 | 186 black-painted over the Sidestep shop, 184 cornice over My Brand, 182 step gable with speklagen |
| `kalver-195-199` | 175256, 175255, 175232 | a 6-axis cornice house with block voussoirs, a bracketed cornice house, a neck gable over a blue timber pui |
| `kalver-204-210` | 167996, 168000, 175223, 175224 | 210 HEMA stucco neck, 208 Cruyff neck, 206 bell, 204 Dogo black-painted neck (Rijksmonumenten 2183-2186) |
| `spui-11-13` | 175740, 175739 | Spui 11 black-painted step gable over a white pui; Spui 13 black front with white block voussoirs, storey bands, pedimented dormer |
| `kloveniersburgwal-90-102` | 171156, 171162 | neo-Renaissance red brick with speklagen and relieving block arches; a stepped wall gable over 100-102, two dormers on 90-92 |
| `achterburgwal-156-160` | 178662, 178663 | brown-brick cornice front with a slate mansard and two dormers over a red-fascia restaurant; a 1700s neck gable over a timber pui |
| `achterburgwal-175-179` | 178647, 178646, 178649 | 175 (1626) over a white pilastered ground storey with a raised centre; 177 (1905) red brick, console entablature, pedimented dormer; 179 plastered, red-tiled roof |
| `achterburgwal-167-169` | 178645, 178644 | two narrow neck gables with pediment caps over white timber puien, cream stone bands on 167 |
| `achterburgwal-202-206` | 179784, 179785 | the 1726 entablature house under a red pantile roof; the low 1758 dark-brick house with two dormers |

## Yield (pands whose strip was looked at)
**Kalverdriehoek** (64 of 131 looked at):
* vetoed before comparison: **49**.
  * Heiligeweg 4-14 and 21-47 (12): narrow street, ghosted strips.
  * Kalverstraat 190-198 (5): double exposure.
  * Kalverstraat 158-170 (5): remodelled 19th-20th-c. fronts, two houses in one pand.
  * Kalverstraat 178-180 (2): modern store fronts.
  * Kalverstraat 157-173 (7): overexposed 2025-01-20 strip with ghosted crowns, mostly modern fronts.
  * Kalverstraat 183-193 and 203 (3): not authored; the run was cut to 195-199.
  * Singel 413-421 (3): a bus covers the ground storeys, 417 is scaffolded, and 413/415 and 417/419 are two houses per pand. Singel 421, a 7-axis Louis XIV house with a crest, cannot stand alone.
  * Singel 437-445 (3): grey gap, a mismatched strip, overexposed.
  * Spui 1-5 (2): one pand holds four houses, and the strip of 175733 is mis-rectified.
  * Voetboogstraat 2-20 (7): coverage 0.
* compared and held: **3**.
  * Rokin 132-136 (168053, 175226): see the open problems.
  * Rokin 130 (175227): the alley between 134 and 130 leaves a 4.15 m gap, and the house cannot stand alone. Its design is ready (bell gable, 4 storeys, bays `[3,3,3,1]`) for a re-intake with Rokin 114-128.
* placed: **12**.

**BG-terrein** (39 of 189 looked at):
* vetoed before comparison: **20**.
  * Kloveniersburgwal 80-158 (4): 171136, 169332 and 177830 are large-tier wide buildings; 177827 is scaffolded.
  * Doelenstraat 2-24 (6): hotels, overexposed.
  * Oude Hoogstraat 2-22 (9): ghosting. No. 14 is an Amsterdam School block of large tier.
  * Oude Turfmarkt 127-149 (1): a large building.
* compared and held: **2**. Oude Turfmarkt 151-153 (179473, 168174): 153's turret needs a pyramid cap, which fails `height-vs-3dbag` (the pyramid stands above the crown line + 0.3 m). `roof.source: 3dbag` fails with "Shell top exceeds observed frontage body". 151 cannot stand alone. Not weakened.
* vetoed before comparison also: Oudezijds Achterburgwal 171 and 173 (178658, 178657): grey gaps in the strip.
* placed: **11**.
* still pending:
  * Kloveniersburgwal 48-50 (2): its old strip used the unpublished day 2023-04-17. The re-intake under the fix below is running.
  * Intakes that failed with "Overpass unavailable": Doelenstraat 2-20 and Oudezijds Achterburgwal 188-196.
  * Faces still in the BG intake queue: Achterburgwal 151-153, 189-197 and 203-205; Voorburgwal 181-193 and 217-249; Kloveniersburgwal 52-62; Rusland 3-29 and 10-26.

## Round 2: Opus verdict applied (`docs/reports/burgwallen-strip-verdict-20261110.md`)
No holds: 4 install, 19 install-with-fix. All 23 pands are reinstalled with the fixes below; every sheet was looked at again (overlay and model).
* **Rows.**
  * Kalverstraat 186 and 184 (rows 0.5-0.9 m low): the photo wall runs to 14.0 m and the console cornice with its soffit to 15.0 m. Eaves now read 15.0 m, under a 1.0 m white console `entablature`.
  * Kalverstraat 199 (rows 0.5 m low): storeys re-measured.
  * Kalverstraat 204 Dogo (top row 0.9 m low): raised.
  * Kloveniersburgwal 90 (top row 0.9 m low): raised under the cornice, so the block arches meet it.
  * Achterburgwal 167-169 (rows 2-3 about 0.7 m low): storeys re-measured; the neck lights are 1.0 m wide.
* **Gables.**
  * Kalverstraat 182: foot 15.0 m, apex 18.75 m (first step 1.2 m higher, apex 0.75 m higher).
  * Kalverstraat 199: a narrow neck (0.4 of the front) on straight flanks that rise only 0.2 of the crown, over a flat cornice.
    `crownAt` with a full-width neck drew the same shape, but it put the blue pui's glazed door outside the wall silhouette (opening-outside audit), so it was not used.
  * Cruyff: a 1.4 m neck (0.26 of the front) with a pointed pediment cap.
  * Pearle: shoulders 1.1 m higher (foot 14.4 m) and a 1.6 m gable light.
  * Kloveniersburgwal 100: the stepped gable is 1.2 m lower.
  * Spui 11: a 1.3 m two-light gable window.
* **Sky instead of roof.**
  * Spui 13 (Provelo), Kloveniersburgwal 100 and Achterburgwal 179 use `continuity.measuredEaves[].frontRoof.topRow` = cornice row - 1. This is the existing front-roof cap, the same mechanism `reviewRoofs.ts` `flatBehindCornice` writes.
  * The Provelo dormer is white stone with a pediment.
* **White.**
  * Bands, blocks and cornices are `#e8e6e0` on Kalverstraat 182, Kloveniersburgwal 90-102 and Achterburgwal 167.
  * Achterburgwal 175's raised centre is white stone (`crownSurface: 'stone'`, `#e2dccb`).
  * Kalverstraat 186, 184 and 195 have white console entablatures.
* **Colour.**
  * Bricks come from `fitWallBrick`, using `scripts/block-face/fit-wall-palette.ts`, a byte-identical copy of the Dapper lane's file. Each brick is fitted to the verdict's target where the review's wall sample is sane: Kalverstraat 195, Cruyff, Dogo, Achterburgwal 158, 167, 169, 177, 179 and 206. The fit for 206 cannot reach its target and stops at the city brick floor.
  * Where the sample reads glass or roof (blue model hue), the verdict target is divided by 1.14: Kalverstraat 184 and 182, Achterburgwal 175.
  * Achterburgwal 202 is painted near-black olive (`painted-brick`). On the model the wall is dark olive; the review's wall sample still reads blue-grey there.
* **Kit additions** (typed, validated, tested in `buildingRecipe/crownStoneAttic.test.ts`, byte-identical when absent):
  * `crownSurface: 'stone'` draws the whole crown in the stone colour (the white raised centre of Achterburgwal 175).
  * `atticLightWidth` (0.4-2.2 m) gives a measured gable-light width, in place of the default share that is clamped to 0.5-0.9 m (Spui 11, Pearle, Achterburgwal 167-169).
  * A narrow neck on a flat cornice and console entablatures needed no new code: the kit's neck fields and `entablature.consoles` express them.
* **Still not expressed:**
  * the small light in Spui 11's top step;
  * the sculpted aedicule of Provelo;
  * the crest on 175;
  * the arched basements of 177 and 206;
  * the cream string courses of 167, which are drawn on the storey lines, not on the sill and head lines.

## Pipeline fixes (typed, tested)
* **Intake skips unpublished panorama days** (`scripts/block-face/intake.ts`, `blockFace/strip.ts` `withoutDays`). The panorama API lists 2023-04-03, 2023-04-11 and 2023-04-17 in the centre, but their images answer 404. The planner picked them as the newest full-coverage day and wrote grey strips that still claimed coverage 1. Intake now sends one HEAD per capture day and drops days that answer 404.
  * Named regression: `burgwallen.test.ts`, "Kloveniersburgwal 48-50: … 2023-04-17 … never planned".
  * Byte-identical when every day is published.
  * **This affects every centre lane.**
* `scripts/block-face/run-face.ts`: cuts a run face out of an intaken face (`--face --run --pands`), reusing `writeRunFace`.
* `scripts/block-face/grid-crop.ts`: rounds the resize and SVG canvas size (a fractional scale crashed sharp).

## Install-time audit lessons (not visible on the sheet)
`compile.ts` prints "glb audit … -> pass" from the holes verdict alone. `report.passed` also needs the audit's other FAIL lines to be clear, so read report.json before trusting the summary.
* **Dormer bodies.** On a shallow attic roof, `dormerBody: 'stone'` with `flat`, `plain` or `pediment` dormers fails `opening-outside` (Achterburgwal 158, Kloveniersburgwal 90-92). `roofFront: 'mansard'` with stone dormers also z-fights slate against brick. `timber`, or `zinc` with `plain`, passes. The white dormers are now timber.
* **Shop windows.** A glazed shop bay at the right end of Kalverstraat 199 reaches past the wall silhouette. The pui keeps that bay closed (a `panel`), and this is listed as a limit on the sheet.

## What the kit cannot say (seen in the photos)
* White stone ornament on step gables; carved crown pieces on gable tops and dormers (Spui 11, Achterburgwal 206).
* Frieze consoles with masks, blind arches under a cornice (Spui 13).
* Round-headed ground openings and black-and-white striped basement-door voussoirs (Spui 13, Achterburgwal 206).
* Cornice caps on dormers; dormers with a segmental head over paired casements (Achterburgwal 158).
* Oval oeil-de-boeuf lights (Rokin 130).
* Raised cornice centres (a stone attic over the middle axis, Achterburgwal 175), drawn as a brick neck gable over that axis.
* Two-tier puien (Achterburgwal 169).
* Turret spires: a pyramid cap over a corner turret fails the height gate (Turfmarkt 153).
* Sunburst voussoirs (Rokin 132).
* White timber erkers with glazing bars: the kit's bay window is brick (Rokin 132).
* A wide gable-foot window plus a small top light in one step gable: the kit draws one narrow attic light (Spui 11).
* Ornamented shop fascias (the red Chinese-style fascia at Achterburgwal 160).
* A pand that wraps behind its neighbour and reaches the street again (Rokin 132, 168053 behind 175226). It fails interference as a one-front house.

## Kit bugs found
* `storeyAxes` on a scalar `bays` grid throws "Non-finite assembly dimension" inside compile, instead of failing validation. It works with a per-storey bays list such as `[3,3,3,1]`.
* `rokin-114-128` intake fails with "Houses of one chunk must front the same direction (>11 degrees)" where Rokin bends. `rokin-146-154` fails with "Seed has no frontage on Rokin".

## Open problems
* **Rokin 132-136 is held.** 168053 wraps behind 175226 and comes back to Rokin at the passage. Interference reads a front gap of -9.17 m, 52 m2 of 175226 inside 168053, and a 10.96 m detail overhang. It needs a two-front or footprint-clipped intent, not a weaker check. The design is in `faces/rokin-132-136/intent.json`.
* Overpass is the bottleneck: up to 640 s per face with many lanes querying it, and some faces fail outright.

## Integrator rebuild list
* Chunks are installed in this branch (`chunks.json`, the GLBs, `chunkWallExposureData.ts`). Rebuild covers (`check:covers`), explorer-looks.json, bundles and coverage-v1.
* Roof golden: recorded for the 9 installed faces only. A whole-table `--write` would also add about 45 faces from other lanes that are on main without golden entries; the lane did not record those.
* Source-data: commit `block-face-strips/kalverdriehoek-20261110/` and `bg-terrein-20261110/`.
