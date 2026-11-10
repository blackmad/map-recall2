# Den Texbuurt (AH07) and Frederikspleinbuurt (AH08), 2026-11-10

Lane `lane/buurt-dentex-frederiksplein-20261110`, MODEL: sonnet. Sheets and strips:
`/Users/blackmad/Code/map-recall2-source-data/block-face-strips/den-texbuurt-20261110/` (`sheet-<run>.png` = photo / model / overlay per pand; `strip-<face>.jpg`).

## Census
* **Den Texbuurt**: 209 BAG pands, 195 built by 1945, 46 proposed faces, no library of its own. Almost all 1900-06 by 3DBAG year band (the survey year is the later re-build year; the facades are 1872-84). Intake ran for Den Texstraat 1-59 (32 pands), 8-58 (27), Weteringschans 84-118, 81-109, 113-151, 197-255 (strips coverage 1.0, 2024-12-03/04).
* **Weteringschans 84-255**: no coherent design. Every house differs (yellow brick, red Neo-Renaissance, painted black, step gables); not attempted.
* **Den Texstraat** is the coherent street: one 1872-84 design of ground plus two tall upper storeys, white sill band, bracket-block hoods, heavy white entablature at 10.7-12.0 m, slate mansard with a pediment dormer. 4 other houses (3, 5, 5A, 5B) are a taller five-row design.
* **Frederikspleinbuurt**: 188 pands, 164 by 1945, 82 faces (mostly 2-10 pands, 4-5 year mixes: Westeinde, Oosteinde, Witsenstraat, Pieter Pauwstraat, Sarphatistraat). Surveyed only; strip taken for Nicolaas Witsenstraat 1-19 (left 3 houses 1880s ornamented, right 7 plain-brick 1890s five-storey rows with stone balconettes). **Nothing placed** in Frederikspleinbuurt.

## Types authored (library `de-pijp`, measured from 40 px/m gridded crops)
1. `tex-1882-hood-bracket-mansard`: Den Texstraat 7-15 and 18-26. Storeys 4.1/3.2/3.4 m, windows 0.52/0.70/0.69 of storey, heads 0.83/0.75/0.78, segmental heads on storey 1, painted sill+head bands, `windowHoods`, entablature rise 1.3, 70 degree slate attic, one pediment dormer over the middle axis. Match: years 1872-84, strip cornice 13.5 m.
2. `tex-1876-balcony-wide-dormer`: Den Texstraat 21-27, the same body plus iron balconettes on the centre axis (storeys 1-2) and a three-light dormer 2.7 m wide (`dormerLights 3`).
Pins: `den-texbuurt-review-{types,doors,palettes,holds}.json`.

## Yield, Den Texstraat 1-59 and 8-58 (31 pands run through auto-place)
Counts are per pand, rounds 1-2 together (final state).
* **vetoed before comparison: 7.** Every type vetoed on year or frontage: 1A, 17A (tex-1-59); 8A, 8B, 10, 12 and the 12.2 m double 14-16 (tex-8-58).
* **compared and held: 11.**
  * 5 on the match score (best type under 0.7: 26, 28, 30, 32, 34);
  * 1 lone pand (30A, between held neighbours);
  * 5 held by the review as a different design (3, 5, 5A, 5B, 19).
* **placed and installed: 13.** Den Texstraat 7, 9, 11, 13, 15 (`tex-1-59-r1`), 21, 23, 25, 27 (`tex-1-59-r2`), 18, 20, 22, 24 (`tex-8-58-r1`).
  Round 1 placed 9; round 2 released 7, 9, 18 and 24 with the roof pins.
Installed with `compile.ts --install` after `auto-place --photo-eaves --photo-decides --no-gate`.
Why `--no-gate`: the likeness gate abstains on these fronts ("usable photo 30-47 %": the cream entablature and the sky over the mansard count as void), so it either holds everything or places on neighbours' evidence. I placed by eye on every sheet; the Opus review (`dentex-strip-verdict-20261110.md`) judged them.

## Round 2: Opus verdict, roof pins, Frederikspleinbuurt
* **Kit (typed, tested, byte-identical when absent).**
  * `pierBlocks` (`buildingRecipe/pierBlocks.ts`, `pierBlocks.test.ts`): white head-line blocks on every pier at the listed storeys, alternating long and short, kept inside the reveals; `dentils` adds a continuous row under the cornice.
  * `dormerLights` accepts 1 (one undivided light).
  * `reviewRoofs.ts`: `<buurt>-review-roofs.json` pins `{pandId, ridgeM | flatBehindCornice, eavesM?, reason}`, consumed by auto-place as `continuity.measuredEaves[].frontRoof.topRow`. It is consumed there rather than in compile, so no new compile path exists; `eavesM` alone is a cornice row clamp. The pandId key matches the other pin files (the brief said `pand`).
* **Den Texstraat verdict applied.**
  * Brick `#645341` (22 `#655444`), 20 `#424c51`, cornice and frieze `#9e9a84`, white `#f0efe6`.
  * Narrow single-light dormer under a taller pediment on the hood types.
  * Erker variant `tex-1882-hood-bracket-erker` for 11 and 15.
  * Top-only balcony variant for 23, flat heads with keystones on 21-27, 27's door on the left (BAG 0363100012179509 checked against the span order), eaves clamps 11 to 13.2 m and 27 to 13.7 m.
  * Roof pins release 9, 18, 24; 7 is back with 9.
* **Frederikspleinbuurt: 7 pands installed.** `witsen-1890-plain-block-mansard` on Nicolaas Witsenstraat 7, 9, 11, 13, 15, 17, 19B (one dark-brown design under several BAG years, 1873-91): ground plus three storeys, flat heads with keystones, white cornice at 14-15.4 m, black mansard with a box dormer. Roof pins cap the mansard at 17.4 m (3DBAG draws a 17.7-18.1 m slab); a pin at 17.2 m failed the GLB audit with 13.7 m2 coplanar roof overlap, so the ridge sits at 17.4 m.
  * 10 pands in `witsen-1-19`: placed 7, vetoed before comparison 1 (3: built 1930), compared and held 2 (1 lone; 3-5 held by review as a different design).
  * Faces intaken and looked at but not typed: Pieter Pauwstraat 2-22 (stoop fronts, nine different designs), Weteringschans 120-132 (stone and Neo-Renaissance, all different), Sarphatistraat 1-13 (a 1960s block and ornamented villas). They do not match the Witsenstraat design, so nothing is extended there.
  * Not done: Witsenstraat 12-18 opposite (4 pands, no strip yet), Westeinde, Oosteinde (mixed designs).

## Overrides and pins to review
* Den Texstraat 20: BAG gives 267 m2 `bijeenkomstfunctie`, which auto-place drew as a shopfront; the strip shows a house door and two windows. `faces/tex-8-58/uses.json` carries `woonfunctie` with a note.
* Palettes: 24 (charcoal), 22 (brown), 20 (blue-grey), 18 (dark brown), from strip medians lifted; 24 and 18 are held anyway.
* Door sides pinned for 7-15 (all left) and 21-27 (right, left, right, right).

## Kit cannot say
* Scroll-cheek dormer of Den Texstraat 18-26 (body with S-scrolls, 1.5 m wide) and the 3-light cheeked dormer of 21-27: drawn as a pediment dormer.
* Bracket blocks above the heads (alternating white keystone-like blocks in a white course), a continuous white sill band thinner than `bands: painted`.
* A per-pand roof pin: 3DBAG ridges at 16.2-16.7 m (9, 24, 18) draw a slate slab; roofs from the photo need a `measuredRidge` or a row clamp across differing years (rowCoherence is same year only).
* Bay window (erker) with its balcony over (Den Texstraat 7, 11, 15): the erker is not drawn.
* Painted dark fronts: palette pins only.

## For the integrator
Round 2 adds `reviewRoofs.ts`, `pierBlocks.ts` and `dormerLights 1`; `test:block-face` 329/329, `test:building-recipes` 499/499, tsc clean. Roof golden was re-recorded for the tex and witsen faces only.

Rebuild covers.json, explorer-looks.json, `chunkWallExposureData.ts` (already written by `compile.ts --install`), bundles; `roof-golden.json` was re-recorded (additions only, 0 reclassed). `test:block-face` 322/322, tsc clean. tex-8-58 stripOverDrawn 0.76 (below the batch's 0.8 floor: the run is dark painted fronts under a bright mansard).

## Round 3 (Opus round-2 verdict)

* **Colour check:** a literal palette pin renders about 1.14x lighter than the pinned hex (`cityWallTint` lifts brick into the city range; the sheet lit-render adds a little more). Brick pins on all four runs now go through `fitWallBrick` (`fit-wall-palette.ts`), and cornice bands use `entablature.frieze: wall` because `palette.cornice` is mixed into the city sandstone. After the fit the model reads within about 0.05 of the photo on Den Texstraat (#635442 vs #5d5948-#6b6a57) and Witsenstraat.
* **Den Texstraat:** white dormer cheeks (dormerBody stone, narrow light), pier blocks 0.8 x 0.5 x 0.3 with dentils (new typed `pierBlocks` kit piece, byte-identical when absent), erkers on 7, 11, 15 and 24, balcony variant on 18, brick fits, eaves pin. Reinstalled tex-1-59-r1, tex-1-59-r2, tex-8-58-r1.
* **Witsenstraat:** stone balustrade balconies (turned rail on white consoles) on 177761 and 177760 on the two middle storeys, iron elsewhere; per-pand fitted bricks; zinc roof and deeper console cornice on 177762, 178936, 178935; raised upper window rows. Reinstalled witsen-1-19-r1 (7 pands).
* **Still not expressible:** Den Texstraat r2 (21-27) dormer is one white gable with a three-light window, not a three-part dormer with a raised centre under a pediment; its centre balcony spans one storey only. Den Texstraat 24 and 20 paint is the fitted dark brick, painted-brick not used. Erkers on 7 and 24 lack the balcony above. Witsen stone balustrades are a turned rail, not a solid stone balustrade.
* Roof golden re-recorded (1 reclassed face of mine, 4 intent changes, all own faces). `test:block-face` 329/329, lint clean.
* Integrator rebuilds: covers.json, explorer-looks.json, bundles; `chunkWallExposureData.ts` is already written.
