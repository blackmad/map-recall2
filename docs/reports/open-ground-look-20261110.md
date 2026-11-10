# Open ground look (lane open-ground-look-20261110)

User decision 2026-11-10, option (b) of feedback 637f346b / 4f47f105 (docs/reports/feedback-triage-20261110.md):
give open ground that is not road or path a truthful look from open data, so lawns, rough lots and yards stop
reading as rideable paving. Rideability is unchanged.

## What changed

- **Classifier** `src/canalRecall/ownGround/groundSurface.ts`: every BGT polygon is one of `road`, `paved-plaza`,
  `path`, `grass`, `bare`, `verge`, `other` (`groundSurface(collection, props, vegShare)`), plus the cover the
  open-ground extract draws (`meadow`, `shrub`, `bare`, `sand`, or none). The sister lane (bgt-plazas) can import it:
  wegdeel `plein` / `voetgangersgebied` / `woonerf` and onbegroeid `gesloten` / `open verharding` are `paved-plaza`.
- **Extract** `public/data/extracts/amsterdam/open-ground-v1/` (291 cells, 7.3 MB gz, largest cell 105 KB): the BGT
  begroeid and onbegroeid terreindeel at ground level that no other extract draws: not in courtyards-v1 (by BGT id),
  not a roads-v1 square (paved onbegroeid up to 20,000 m²), cut free of every OSM area fill and of every raised
  roads-v1 surface (h ≥ 1: the level-0 grass under a viaduct or way-deck approach drew over its carriageway) (polygon-clipping
  difference, so no two ground fills overlap; 1 clipping failure city-wide fell back to the interior-point test).
  `erf` yards, `zand`, `onverhard` and `half verhard` are judged by the PDOK CIR aerial (2025, 0.5 m): a yard at least
  50 % vegetated is grass, bare ground at least 30 % vegetated is grass (the early-spring flight: the Moermanskkade
  lot, BGT `zand`, is meadow on the photo and 44 % over NDVI 0.12). Built by `scripts/own-ground/build-open-ground.ts`
  from `scripts/own-ground/fetch-bgt-open-ground.ts`; raw inputs archived to
  `map-recall2-source-data/datasets/bgt-open-ground-20261110/` (545 MB, not committed there).
- **Runtime** (`groundStore.ts`, `groundCell.ts`, `groundWorker.ts`, `gameGround.ts`): the store loads the
  extract like courtyards-v1 (`?openGround=0` / `window.__canalRecallOpenGround = false` off); the cell draws each
  area at the parks' lifts, and the land quads wholly inside one are culled as under courtyards. A cell whose 3×3
  neighbourhood has no open ground gets no `openGround` input, so its build is byte-identical (pinned: an empty
  extract cell builds the same arrays).
- **Look**: meadow draws in the courtyard green (`garden`, groundLook gardenTone, luma 124): the orthophoto's
  dehazed sunlit median inside the meadow polygons at the five spots is 126,127,106, luma 125
  (`scripts/own-ground/measure-open-ground-tones.ts`, 107,688 texels). Shrubs and sand use the parks' layers. Bare
  earth is a new appended layer `bare` (palette `GROUND_TONES.bare`, 160,144,122 with grit dabs at the land's tone,
  luma ~146): the photo measures 136,124,115 at the spots and 192,185,170 (luma 185) on the large raised lots where most
  of it lies, as light as the paving-grey land, so the hue is between them and the luma kept 30 under the land.
  Its texture is painted last, so every other ground texture keeps its random stream.

## Census: BGT open ground drawn as the default grey (land), m²

Open ground = begroeid + onbegroeid terreindeel at ground level, not courtyards-v1, not a roads-v1 square, after
cutting out the OSM area fills. Verges (ondersteunendwegdeel) are drawn by roads-v1 and not counted.

| class | city before | city after | Centrum before | Centrum after |
|---|---:|---:|---:|---:|
| grass (begroeid, green erf, grown-over bare) | 3,703.2 ha | 2.7 ha | 13.0 ha | 0.07 ha |
| bare (zand, onverhard, half verhard) | 397.0 ha | 0.2 ha | 0.9 ha | 0.004 ha |
| paved-plaza (paved onbegroeid over 20,000 m²: industrial yards) | 317.3 ha | 317.3 ha | 0 | 0 |
| other (erf paved on the aerial or unknown) | 1,047.3 ha | 1,047.3 ha | 12.5 ha | 12.5 ha |

What remains grey is paved (yards, plazas) or unknown (shadowed yards), which the paving grey describes; the
"after" grass and bare are parts under 2 m² after the OSM cut. By BGT type, before: groenvoorziening 1,638 ha,
erf (paved/unknown) 1,047 ha, green erf 591 ha, grasland agrarisch 468 ha, grasland overig 369 ha, gesloten verharding
315 ha, zand 310 ha, loofbos 294 ha, bouwland 88 ha, onverhard 84 ha, rietland 81 ha. Drawn now: meadow 3,185 ha,
shrub 516 ha, sand 310 ha, bare 87 ha. Full table: `staging/census.json` in the archive.

## Pins

`src/canalRecall/ownGround/openGroundRegressions.ts` (OPEN_GROUND_SPOTS), tested by
`src/canalRecall/ownGround/groundSurface.test.ts` (extract probes, and built cells on/off):

| spot | probe | expect |
|---|---|---|
| Heathrowstraat (637f346b) | lawn strip north of the footpath | meadow (garden layer) |
| Heathrowstraat | the paved forecourt the rider stood at (erf) | unchanged |
| Barajasweg (4f47f105) | lawn east of the office courtyard | meadow |
| Barajasweg | the paved office courtyard (erf) | unchanged |
| Moermanskkade (020e2132) | the empty lot (BGT zand, meadow on the photo) | meadow, land culled |
| Sloterdijkerweg (28ae61fb) | woodland west of the road by the rail yard | meadow |
| Nieuwmarkt | the paved square south of the Waag | unchanged (paving) |
| Nauernaseweg (check:bridge-gaps) | the carriageway of the way-deck approach, two probes | nothing drawn (was bare and meadow over the road) |

## Frames

Real browser rides (`tests/e2e/open-ground-frames.spec.ts`, `OPEN_GROUND_FRAMES=1`, before with `?openGround=0`),
desktop and iPhone, a ride frame and an aerial frame per spot, beside a 160 m PDOK orthophoto crop
(`scripts/own-ground/open-ground-strip.ts`). Saved to
`map-recall2-screenshots-a1/roads/2026-11-10-open-ground/` (`strips/<project>-<spot>-<view>.jpg`, the raw frames under
`before/` and `after/`, the ortho sheets under `ortho/`).

| spot | verdict |
|---|---|
| Heathrowstraat | the lawn strips and the planted bed along the footpath are green; the forecourt the rider stood at, the car park and the paths stay paving, as on the photo |
| Barajasweg | the lawns around the office blocks and along the canal read green; the paved office courtyard and the forecourts stay paving; the cycle path and footways unchanged |
| Moermanskkade | the empty lot is meadow (it was a 1 ha paving-grey square); the footways round it stay paving |
| Sloterdijkerweg | the strip between the road and the rail yard, woodland on the photo, is meadow instead of paving; trees are not added (the tree layer is another extract) |
| Nieuwmarkt | the square and the streets are unchanged (no open ground drawn there); a few back gardens east of the Kloveniersburgwal turn green |

Not done here: overview tiles and the far ring still draw open ground in the land tone (see below).

Pre-existing check failures, identical with `openGround: false` (checked with every store of check-ground-cells
switched off): rail-infra-amstel pin, rail-oostertoegang LOD 1 (0.99 %), the BRU0166 / BRU0063 railing
"parapet off the carriageway" (2.5 / 2.9 m), OSM7382983 half-width parapets.

Finding for the plaza lane: artificial-turf pitches are BGT onbegroeid `gesloten verharding` (e.g. OSM w66648187 in
cell -5_1), so the classifier calls them `paved-plaza` and roads-v1 already draws them as paving over the OSM pitch.
They must not become rideable plazas: check for an OSM `leisure=pitch` overlap.

## Cost and budgets

- open-ground-v1: 7.3 MB gz over 291 cells (mean 25 KB, max 105 KB), the extra fetch per resident cell.
- Triangles per built cell (offline buildCell, `?openGround=0` → on; drape 12 m / 1 cm near, 32 m / 5 cm far,
  groundSurface.ts OPEN_GROUND_DRAPE; at the parks' 8 m / 2 mm it was +33 % / +43 % in -5_1):

  | cell | LOD 0 | LOD 1 |
  |---|---|---|
  | -5_1 Nieuw-West (Heathrowstraat, Barajasweg) | 320,110 → 380,377 (+18.8 %) | 113,179 → 133,916 (+18.3 %) |
  | 1_0 Oostelijke eilanden | 342,431 → 395,344 (+15.5 %) | 121,558 → 136,538 (+12.3 %) |
  | -4_1 Sloterdijk | 337,106 → 384,794 (+14.1 %) | 100,976 → 115,739 (+14.6 %) |
  | -3_0 | 371,133 → 392,076 (+5.6 %) | 118,507 → 126,530 (+6.8 %) |
  | -2_3 Moermanskkade | 142,976 → 145,769 (+2.0 %) | 62,033 → 63,176 (+1.8 %) |
  | 0_0 Centrum (Nieuwmarkt) | 432,964 → 443,165 (+2.4 %) | 168,355 → 171,456 (+1.8 %) |
  | -1_-1 Centrum (Rembrandtplein) | 406,560 → 408,707 (+0.5 %) | 118,820 → 120,038 (+1.0 %) |

  Two more draw calls per cell at most (the new `bare` layer, and `garden` where a cell had no courtyard green).
- world-v1: unchanged (the extract is a ground input, not a world cell): 0 bytes delta.
- Overview tiles: not rebuilt here; until they are, the flat map far below shows open ground in the land tone.
  The far ring (farRing.ts) does not draw open ground either.

## What the kit still cannot say

- Reeds, rough meadow, farmland and mown lawn all draw as the one meadow tone; a rough-grass texture would tell a
  lot from a lawn. Woodland floor draws as meadow (BGT `groenvoorziening` under trees) or shrub (`loofbos`).
- No soft edge or kerb between paving and grass yet (the land under a strip narrower than a 5 m quad stays under
  the meadow at 18 mm, as under courtyards).
- Paved yards are still the land's grey, the same as rideable paving: only the plaza lane's rideability tells them apart.

## For the integrator

- Rebuild the bundles that include the ground runtime and the palette: `own-ground-game`, `own-ground-worker` (and any
  other bundle importing `look/palette.ts` or `overviewTiles/layerColours.ts`).
- Add `src/canalRecall/ownGround/groundSurface.test.ts` to `test:own-ground`; optionally
  `"build:open-ground": "tsx scripts/own-ground/build-open-ground.ts"`.
- Commit the archive `map-recall2-source-data/datasets/bgt-open-ground-20261110/`.
- Later: rebuild the overview tiles and teach the far ring the open ground, so the far view stops showing it grey.

## Follow-up: Nauernaseweg way deck (integrator 2026-11-10)

`check:bridge-gaps` nauernaseweg-way-deck failed after the merge: 187.2 m² of carriageway off the road (≤ 160), land
189, against 130.5 / 126 with open ground off. Cause: BGT is a partition per level, so the level-0 grass and bare
ground under the h 1 road polygons of the way deck's approach were open ground, and where the game draws that
approach at ground height the meadow (lift 18 mm) topped the asphalt. Fix at the source: build-open-ground.ts now
also cuts every roads-v1 surface with h ≥ 1 out of the open ground (3×3 neighbourhood, holes kept). The pin is back
to 130.5 m² / land 126 (identical to open ground off), pinned as the `nauernaseweg` spot (two carriageway probes:
the old extract drew bare and meadow there). City-wide the cut removes 8.1 ha of meadow, 1.0 ha bare, 0.2 ha sand,
0.3 ha shrub under raised roads (they show the land there, as before this lane); extract 7.3 MB gz unchanged.
