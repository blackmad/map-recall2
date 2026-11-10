# Haarlemmerbuurt-West (AA05) and -Oost (AA06), 2026-11-10

Lane `lane/belt-haarlemmer-20261110`. **9 pands installed: West 7 (Haarlemmerdijk 4, 6, 16, 18, 20, 131, 133A), Oost 2 (Haarlemmerstraat 52, 54).** Round 2 (below) added the white balance for the foliage masks, the wide multi-light types, the frieze type and the strip-sheet review fixes.
Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/haarlemmerbuurt-20261110/`
(`strips/<face>-strip.jpg` + `-labelled.png` for 19 intaken faces, `sheets/<run>-strip-sheet.png` + `-overlay.png` for the four installed runs).

## Census

| buurt | pands | faces (survey) | intaken faces | compared pands | monuments (gable key) |
|---|---|---|---|---|---|
| AA05 Haarlemmerbuurt-West | 389 | 66 | 8 (Haarlemmerdijk 2-58, 13-45, 66-120, 67-91, 93-113, 117-143, 126-188, 149-175) | 88 | 108 (cornice 31, neck 26, plain 24, bell 16, step 3) |
| AA06 Haarlemmerbuurt-Oost | 328 | 75 | 11 (Haarlemmerstraat 1-17, 23-47, 34-42, 46-96, 77-91, 93-139; Brouwersgracht 2-20, 126-160, 218-244, 266-280; Herenmarkt 2-20) | 26 | 163 (neck 73, cornice 52, bell 17, step 7) |

Not intaken: Haarlemmerstraat 2-22 (Overpass unavailable twice), 98-148, Brouwersgracht 68-84 and 246-262, Herenmarkt 1-27, and the short and single-pand faces.

The design families, read off the strips:
- **Haarlemmerdijk / Haarlemmerstraat shop-house.** Three storeys, or four, over a tall (4.0-4.7 m) shop ground floor. It has two or three axes and white frames, with a neck, bell or point gable, or a white cornice with a pediment dormer. This is the bulk of both buurten.
- **Brouwersgracht.** Five-storey canal houses and warehouses (pakhuizen) with loading-door axes and shutters. Every front is a one-off, and on the 2021/2024 strips the fronts are behind trees or houseboats.
- **One-offs.** Eclectic towers (Haarlemmerdijk 125), Jugendstil fronts (39, 43), two-storey bell-gable cottages (Haarlemmerdijk 25, 119A, 121A, 143; Brouwersgracht 20) and post-1990 infill.

## Types (new library `scripts/block-face/types/haarlemmerbuurt/`, district `haarlemmerbuurt`)

| type | body | used |
|---|---|---|
| `haarlemmer-shop-gable` | 3 storeys [4.5, 2.9, 2.6], neck / bell / bell-low / point crowns, square saddle | 20 (neck), 4 (bell-low) |
| `haarlemmer-shop-cornice` | same body, white simple cornice, none / pediment-dormer crown, saddle hipped at the front (35°) | 16 |
| `haarlemmer-shop-cornice-frieze` (round 2) | the brick stops under a deep cream attic frieze (`cornice: frieze`) with a small crowned piece over the middle (`crownCap` pediment, narrow), a flat roof: no roof face over it | 6, 18 |
| `haarlemmer-shop-cornice-wide`, `haarlemmer-shop-gable-wide` (round 2) | two axes of wide three-light windows under top lights (`casement-sidelights-toplight`, window share 0.74), `match.columnsPerBay` [2, 4]; the cornice one with a crowned piece and a flat roof | 131, 133A |
| `haarlemmer-shop-cornice-four`, `haarlemmer-shop-gable-four` | 4 storeys [4.0/4.4, 2.8, 2.7, 2.5-2.6] | none placed |
| `haarlemmerstraat-sash-{gable,gable-four,cornice,cornice-four}` | 6-over-6 sash windows, years to 1995 (Haarlemmerstraat rebuilt fronts) | 52, 54 (sash-gable-four) |

They all use the palette `haarlemmer-red-brown` (brick #6e4a3c, white-painted frames and stone), sill surrounds and window share 0.52. They set `crownMatch`/`crownStrict` to false: the fused dijk strips carry ghost gables of the neighbours, so reviewer crown pins decide the crown. They use `mirrorForDoor` left.

## Yield

Counts are from `<buurt>-placement.json`. Lane-review holds include reviewer-pinned pands whose score or compile failed, with the reason in the hold.

| outcome | West | Oost |
|---|---|---|
| vetoed before comparison: face not intaken, or strip not reviewed (see "Strips") | 301 | 302 |
| compared and held: strip evidence gate | 1 | 0 |
| compared and held: best type under 0.7 / every type vetoed (year, frontage) | 3 | 0 |
| compared and held: likeness gate under 0.15 (Haarlemmerdijk 21 0.10, 23E 0.12, 68; Haarlemmerstraat 50 0.09, 46 0.14) | 3 | 2 |
| compared and held: run of one between held neighbours | 4 | 1 |
| compared and held: lane review, including the score / compile / sheet failures named in each reason (31-33-35A, one-offs, five storeys, cottages, occluded, infill) | 70 | 21 |
| **placed and installed** | **7** | **2** |

Installed runs:
- `chunk-face-haarlemmerdijk-2-58-r1`: Haarlemmerdijk 20 (neck gable, 2/2/3 windows), 18 (cream frieze, crowned piece, cream shop), 16 (cornice, first upper row 0.5 m lower). 2736 tris. NCC 0.27 / 0.37 / 0.53.
- `chunk-face-haarlemmerdijk-2-58-r2`: Haarlemmerdijk 6 (cream frieze, crowned piece, cream shop, door right) and 4 (lower bell, cream shop). 1993 tris. NCC 6: 0.21.
- `chunk-face-haarlemmer-46-96-r1` (round 2): Haarlemmerstraat 54 and 52, neck gables over three sash rows. 3798 tris. NCC 0.24 / 0.30. Released by the white balance.
- `chunk-face-haarlemmerdijk-117-143-r1` (round 2): Haarlemmerdijk 131 (wide windows, crowned cornice) and 133A (neck gable, wide windows). NCC 0.17 / 0.14 (accept pin 0.12: a van covers the shop and the strip span sits about 1.5 m off the BAG split).

## Round 2 (strip-sheet review and coordinator list)

- **White balance for the foliage masks** (`src/canalRecall/blockFace/stripWhiteBalance.ts` + test on three real strip crops in `fixtures/strip-cast/`). Per panorama day, the reference white is the median of the brightest 15 % of the strip's pixels (placeholder grey, clipped and blue sky left out); gains map it to grey. Applied only under a green or yellow-green cast (reference G - R over -4 % of its luma and G over B); a warm day keeps the plain `isLeaf`, byte-identical. Used by the likeness photo mask (`spanLikeness` `leaf`), the body-band foliage share (`evidenceShares`, `bodyShares`) and batch.ts's foliage columns. Haarlemmerstraat 46-96: foliage 31 % -> 3 % of the body band; Brouwersgracht 2-20 (2024-12-03): the cast trim goes, the green bush in front of no. 4 stays foliage (0.64 -> 0.52). **Measured colours stay on the unbalanced strip:** brickForDrawnLuma, the row trim gain and the city look's brick lift are calibrated on unbalanced strips in every installed buurt, and the cast moves the brick median a few per cent (gains 0.95-1.07) while it moves the leaf share by 25 points.
- **Wide multi-light windows:** `match.columnsPerBay` (autoPlace.ts `columnsCriterion`, tested): the strip's window columns may number `bays` x [min, max]; the wide types take [2, 4], the shop types [1, 2] (a T-window's mullion reads as a second column). Released 131 and 133A; 23E now scores 0.82 but its likeness is 0.12 (held); 129 is a band-window front like 127, not this type.
- **Haarlemmerdijk 31-33-35A:** the 3 cm overshoot is the front-hipped saddle on a skewed frontage: along the facade line the hip plane climbs 0.75 cm/m because the setback line is square to the front normal, not the facade edge. 33 and 35A carry deep friezes, so the frieze type with a flat roof (the strips show sky directly over the cornice; 3DBAG p95 near the cornice) compiles with every gate. But the sheet does not look like the photo (33 needs three axes and three upper rows; 35A NCC 0.11 with its span 1 m off the split), so both stay held. 31 keeps a 0.9 m2 coplanar brick/roof-tile overlap behind its point gable (geometry regression), held. The hip-front skew itself is not fixed: recipeRoof.ts's square-to-chord retry covers attic bands and `squareSaddle`, not `hip: front` saddles.
- **Strip-sheet review fixes** (docs/reports/haarlemmer-strip-verdict-20261110.md): `reviewShopfront.ts` (+ test) pins shop paint and door (`<buurt>-review-shopfronts.json`): cream on 4, 6, 18, door right on 6. `reviewBays.ts` now takes per-storey counts and `headLines`: 20 gets two, two, three windows; 16's first upper row 0.5 m lower. 18 and 6 moved to the frieze type with a crowned piece (eaves at the cornice top: 11.4 and 11.0 m); 4 to a lower bell (`bell-low`, crownRise 0.85). **Not done:** the gable positions of 20 and 4 ("0.9-1 m right") are the strip's registration, not the model: every facade on the 2-58 strip sits 0.4-0.9 m right of its BAG split, and the models stand on BAG; the neck window width of 20 (the kit draws one attic light of a fixed share).

## Strips

- **2024-11-21 and 2024-12-11 carry a yellow-green cast.** On those strips 16-49% of the brick classifies as leaf, so the likeness gate abstains ("usable photo" under 50%). This affected most of Haarlemmerstraat and Haarlemmerdijk 67-113, 126-188 and 149-175. Round 2's white balance released Haarlemmerstraat 54 and 52; 50 (NCC 0.09) and 46 (0.14) are held by likeness, and 48B (a wide three-light window) as a run of one.
- **2022-12-15 is dark but neutral.** It is the strip used on the dijk. On Haarlemmerdijk 13-45 the facade foot sat 2.2 m up the strip, and `--camera-height=2.4` fixes it. On 117-143 the geometry is right without that flag.
- **Other days are unusable:**
  - 2025-07-03 is blown out;
  - 2020-01-10 on Haarlemmerstraat is occluded by a truck and stretched;
  - 2022-12-15 on Haarlemmerstraat doubles the fronts.
- **Brouwersgracht strips are unusable:**
  - 126-160 is ghosted and mis-registered;
  - 266-280 is behind houseboats;
  - 218-244 is behind trees.
- **Grey-strip check:** after the 404-day cherry-pick (9c09e2883), no strip in this lane was grey.

## Kit additions

- **`src/canalRecall/blockFace/reviewBays.ts` (+ test).** A reviewer pins a pand's window-axis count (`bays` in `<buurt>-review-types.json`), because on the dijk the axis count does not follow frontage width. The module validates the pins (16-digit pand, integer 1-6, a known type, no duplicates). Output is byte-identical without pins.
- **Eaves pins feed the evidence.** `auto-place.ts` puts the reviewer's eaves pin into `PandEvidence.eavesM`. The survey value is kept as `surveyEavesM`, the same field name as the Nieuwendammerdijk branch. Before this, scoring and storey counting used 3DBAG eaves that are wrong on the dijk: they are off by 1-2 m where fused roofs run across neighbours.
- The eight haarlemmerbuurt types above, and the front-hipped roof for cornice shop-houses.

## What the kit cannot say yet

- **Band (ribbon) windows of 4-6 lights across a front** (Haarlemmerdijk 127, 129): the wide types draw two windows with side lights.
- **Strip registration:** on 2-58 and 117-143 the facades sit 0.4-1.5 m right of their BAG split, which lowers the edge NCC and moves gables on the sheets.
- **The crowned piece is a brick pediment cap,** not the cream moulded dormer front; the attic light of a neck gable has no width setting.
- **A four-storey frieze body** (Haarlemmerdijk 33).
- **Two-storey bell-gable cottages,** where the gable carries a storey-high window (Haarlemmerdijk 25, 119A, 121A, 143; Brouwersgracht 20). The shop types start at three storeys.
- **Five-storey fronts** (Haarlemmerdijk 135A; Brouwersgracht 4, 6, 8).
- **Warehouse (pakhuis) loading-door axis with shutters and hoist beam.** This is most of Brouwersgracht.
- **Neck-gable scrolls and claw-piece ornaments, erkers over shops, ornate stucco bands.** These are drawn as plain gables and plain cornices.
- **A front-hipped roof over a cornice on a skewed frontage** climbs 3 cm along the facade (see Round 2); the frieze type avoids it with a flat roof. On 31 the point-gable wall and roof tile overlap coplanar (geometry-regression).
- **measureFacade's own leaf mask** (the secondary likeness.ts reasons: "NO EVIDENCE: foliage 30 %") is not white-balanced; only the gates' masks are.
- **The other green-cast faces are not yet compared:** Haarlemmerstraat 1-17, 23-47, 34-42, 77-91, 93-139 and Haarlemmerdijk 67-91, 93-113, 126-188, 149-175 need a strip review pass now that the mask works.
