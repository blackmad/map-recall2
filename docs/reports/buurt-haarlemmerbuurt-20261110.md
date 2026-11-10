# Haarlemmerbuurt-West (AA05) and -Oost (AA06), 2026-11-10

Lane `lane/belt-haarlemmer-20261110`. **5 pands installed, all in West (Haarlemmerdijk 4, 6, 16, 18, 20); Oost 0.**
Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/haarlemmerbuurt-20261110/`
(`strips/<face>-strip.jpg` + `-labelled.png` for 19 intaken faces, `sheets/<run>-strip-sheet.png` + `-overlay.png` for the two installed runs).

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
| `haarlemmer-shop-gable` | 3 storeys [4.5, 2.9, 2.6], neck / bell / point crowns, square saddle | 20 (neck), 4 (bell) |
| `haarlemmer-shop-cornice` | same body, white simple cornice, none / pediment-dormer crown, saddle hipped at the front (35°) so no roof face shows over the cornice | 16, 18, 6 (dormer) |
| `haarlemmer-shop-cornice-four`, `haarlemmer-shop-gable-four` | 4 storeys [4.0/4.4, 2.8, 2.7, 2.5-2.6] | none placed |
| `haarlemmerstraat-sash-{gable,gable-four,cornice,cornice-four}` | 6-over-6 sash windows, years to 1995 (Haarlemmerstraat rebuilt fronts) | none placed |

They all use the palette `haarlemmer-red-brown` (brick #6e4a3c, white-painted frames and stone), sill surrounds and window share 0.52. They set `crownMatch`/`crownStrict` to false: the fused dijk strips carry ghost gables of the neighbours, so reviewer crown pins decide the crown. They use `mirrorForDoor` left.

## Yield

Counts are from `<buurt>-placement.json`. Lane-review holds include reviewer-pinned pands whose score or compile failed, with the reason in the hold.

| outcome | West | Oost |
|---|---|---|
| vetoed before comparison: face not intaken, or strip unusable (see "Strips") | 301 | 302 |
| compared and held: strip evidence gate | 1 | 0 |
| compared and held: best type under 0.7 / every type vetoed (year, frontage) | 4 | 0 |
| compared and held: likeness gate abstains (green-cast strip) | 1 | 5 |
| compared and held: run of one between held neighbours | 5 | 0 |
| compared and held: lane review, including the score / compile failures named in each reason (wide multi-light windows at 0.55, the 31-33-35A compile failure, one-offs, five storeys, cottages, occluded, infill) | 72 | 21 |
| **placed and installed** | **5** | **0** |

Installed runs:
- `chunk-face-haarlemmerdijk-2-58-r1`: Haarlemmerdijk 20 (neck gable), 18 and 16 (cornice). 2608 tris. Every gate and audit passes.
- `chunk-face-haarlemmerdijk-2-58-r2`: Haarlemmerdijk 6 (cornice and dormer) and 4 (bell gable). 2100 tris.

The dormer of Haarlemmerdijk 18 is left off. The kit dormer on the front-hipped roof hovered 0.10 m over the roof there, which is an audit `detached` failure.

## Strips

- **2024-11-21 and 2024-12-11 carry a yellow-green cast.** On those strips 16-49% of the brick classifies as leaf, so the likeness gate abstains ("usable photo" under 50%). This affected most of Haarlemmerstraat and Haarlemmerdijk 67-113, 126-188 and 149-175. Haarlemmerstraat 46-96 has five reviewer-pinned pands (54, 52, 50, 48B, 46) that are held only for this reason. They are ready to place once the strip mask white-balances.
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

- **Wide multi-light (three-light, transomed) 19th-c. shop-house windows.** The strip reads 5-7 columns where the type has 2-3 axes, so the score lands at 0.55. This keeps Haarlemmerdijk 23E, 129, 131 and 133A held.
- **Two-storey bell-gable cottages,** where the gable carries a storey-high window (Haarlemmerdijk 25, 119A, 121A, 143; Brouwersgracht 20). The shop types start at three storeys.
- **Five-storey fronts** (Haarlemmerdijk 135A; Brouwersgracht 4, 6, 8).
- **Warehouse (pakhuis) loading-door axis with shutters and hoist beam.** This is most of Brouwersgracht.
- **Neck-gable scrolls and claw-piece ornaments, erkers over shops, ornate stucco bands.** These are drawn as plain gables and plain cornices.
- **A front-hipped roof over a cornice on a skewed frontage.** On Haarlemmerdijk 33 and 35A the roof stands 0.03 m over the crown line (`roof-under-crown`). On 31 the point-gable wall and roof tile overlap coplanar (geometry-regression), so the run 31-33-35A is held.
- **The pipeline has no white balance before the likeness mask** (see "Strips").
