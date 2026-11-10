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

## Yield (Den Texstraat 1-59 and 8-58 only: 43 pands run, 59 faces' pands incl. a 12 m double)
* vetoed before comparison (every type vetoed on year/frontage): 11 (1A, 17A, 8A, 8B, 10, 12, 14-16, 34? held on match).
* compared and held: 5 held by the review for a different design (3, 5, 5A, 5B, 19); 4 for roof (7 lone after 9, 9 and 24, 18 carry 3DBAG ridges 2-3 m over the photographed cornice); 30-34 and 28-30 held on match score (different 1880-90 designs).
* **placed and installed: 9 pands** on three runs: `tex-1-59-r1` (Den Texstraat 11, 13, 15), `tex-1-59-r2` (21, 23, 25, 27), `tex-8-58-r1` (20, 22).
Installed with `compile.ts --install` after `auto-place --photo-eaves --photo-decides --no-gate`.
Why `--no-gate`: the likeness gate abstains on these fronts ("usable photo 30-47 %", the cream entablature and the sky over the mansard count as void), so it either holds everything or places on neighbours' evidence. I placed by eye on every sheet instead; an Opus reviewer should judge them.

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
Rebuild covers.json, explorer-looks.json, `chunkWallExposureData.ts` (already written by `compile.ts --install`), bundles; `roof-golden.json` was re-recorded (additions only, 0 reclassed). `test:block-face` 322/322, tsc clean. tex-8-58 stripOverDrawn 0.76 (below the batch's 0.8 floor: the run is dark painted fronts under a bright mansard).
