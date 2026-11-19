# Feedback triage, 2026-11-16 (refreshed 2026-11-19)

Source: `npm run feedback:queue -- pull --status all` (150 notes, `atLimit: false`). The 78 ride notes of the
original triage are unchanged; no new ride notes arrived. The 13 new notes since 2026-11-16 are David's
Shopfronts-page notes, which belong to `lane/chain-logos-20261116`. Verdicts per note:
`docs/reports/feedback-triage-20261116-verdicts.tsv`.

## Counts (78 triaged ride notes)

| Verdict | Notes | Queue status set |
|---|---|---|
| fixed since | 40 | resolved |
| answered | 6 | resolved |
| shopfront lane (9d5ac5) | 1 | in-progress |
| open | 31 | open |

Older notes outside this triage (16 in-progress, 4 deferred, 39 resolved before) were left alone.

## Open themes, ranked

### 1. Bridge seams, rails and water slits (7 open) - wrong geography / navigation
Notes: 935a68 (Kloveniersburgwal), 4c1344 (Doelensluis), 62d5a3 (Vijzelstraat tram rails), 3b8ca6 and 71028a
(De Clercqstraat / Bilderdijkgracht seams), e3838e (Rembrandtpark cycle path seam), c16d34 (Torensluis water slit).
Fix: pin each as a named OSM bridge regression in `scripts/check-canal-car.ts` and the bridge pins
(`bridge-feedback-pins.ts`), then fix deck/quay-wall cutting per bridge. Tram rails: snap rail ribbons to the
carriageway where the OSM tram way is within tolerance. Files: bridge deck/quay builders in `src/canalRecall/`
(bridges), `scripts/check-canal-car.ts`, road surface builder. Size: M-L (7 junctions, each needs a panorama).

### 2. Interaction and HUD that hurt play (2 open)
704240 (El Tawheed building cannot be tapped), d18eca (START marker floats in the sky at Westerpark /
Haarlemmerweg). Fix: reproduce tap with footprint picking on that building (likely tall-building footprint or
shell-LOD pick target); anchor the START marker to ground height at its position. Files: footprint-tap code in
`public/canal-drive/game.js` adapter, HUD marker code. Size: S each.

### 3. Floating / overlapping windows (6 open)
Notes: 18a9d3, 0046bb, e058c8, 1a223c, d99e51, f8f282. Window boxes of neighbouring blocks interpenetrate,
erkers/annexes cut windows, grid disagrees with photo. Fix: a generic overlap pass in the window layout that
clips or drops openings intersecting a projecting mass or a neighbour box, plus a gate (like
`check-glb-openings`) over the generic-house builder; pin Postjesweg, Kostverlorenvaart, Slotervaart blocks.
Files: facade opening layout and grid() glazing in the building builders. Size: M.

### 4. Ground look and holes (5 open)
c57c04 (asks for a general broken-ground detector), eaf0aa (Spaarndammertunnel mouth), ee2b30 (lamp posts in
water off Haparandadam pontoon), 47d096 (only 2/3 of a frontage drawn), plus e41668 (tiled photo facade repeats).
Fix: a city-wide ground-anomaly detector built from `check-ground-spots`, `probe-hole-junctions`,
`check:rail-joins`; drop street furniture whose base is over water; investigate the partial frontage at Jan
Hanzenstraat. Files: `scripts/check-ground-spots*`, street-furniture placement, ground builder. Size: M.

### 5. Looks: grey walls, generic houses (5 open)
45abd3, ba2f5b, 8022e3 (Riekerpolder/Slotervaart pale boxes), 174f6f (OBA near-black, waits on needs-david #385),
a9198f (cartoon-y generic houses). Fix: belongs to the rows/buurt-look programme; re-frame after F2 vetoes,
then pick a palette for the industrial and post-war families by neighbours. Size: L, programme work.

### 6. Custom-model requests (6 open)
4b1114 Schutterstoren, ef65d8 Schiphol terminals, c361c8 (building on a bridge), 13fa7f Politiepost IJburg
untextured parts, 347e64 Politiebureau Oost Zeeburg rear windows, deb3fc (Westerpark sculpture card has no
photo). Fix: landmark-lane queue; 13fa7f and 347e64 are quick landmark touch-ups. Size: S each, Schiphol L.

## Shopfront notes
9d5ac5 and the 13 Shopfronts-page notes (c2ad69, 976d72, 58f776, c09ff8, 28c639, 4e60f5, 012a3e, 062479, 6927c2,
f0b92d, b60d39, fab9c8, 487b0d) go with the chain-logos lane; status is theirs to set.
