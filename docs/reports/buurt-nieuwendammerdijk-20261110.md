# Nieuwendammerdijk-West (NF03) and -Oost (NF04), 2026-11-10

Lane `lane/buurt-nieuwendammerdijk-20261110`, MODEL: sonnet. Survey, two types, one eaves pin mechanism, **6 pands installed** (West).
Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/nieuwendammerdijk-20261110/`
(`sheet-cottage-135-163-r1-INSTALLED.png`, `sheet-villa-300-308-r1-NOT-installed.png`, `contact-installed.jpg`, `strip-<face>.jpg`).

## Census
West 369 BAG pands in the survey (256 on Nieuwendammerdijk; Meerpad 42, Leeuwarderweg 33, the rest tiny), East 113 (112 on the dijk).
BAG years are useless here: the same identical cottage row reads 1905/1935/1960/1984 (renovations), and 3DBAG bouwlagen 3 with roof max 9-10 m for one-storey cottages with dormers.
West: 66 pands "1930s" three-storey in 3DBAG, 56 "1980s" (modern infill rows, e.g. 12-22 and 24-32: brick, garage door, big dormers), the rest scattered 1880-1970.
Faces: 170 proposed in West, 63 in East; most are runs of 1-2 pands because the dijk is a patchwork. The wooden dike houses (houten huizen) are unique singles: none is a repeated family, and no face of 3+ pands shows timber cladding (intake of ~12 faces read; 113-129 and 135-163 hold the only painted-black and cream fronts, individual).
Strips read by eye (intake done): 9-43 (2-storey painted/brick rows with white ground window bands, flat dormers, individually painted), 12-22 and 24-32 (1980s infill), 46-58 (one-storey brick/painted cottages with cream gabled dormers), 113-129 (c.1900 one-storey rows with arched windows, gabled dormers with bargeboards, brick bands), 135-163, 170-182 (mixed timber and brick singles), East 300-308 (five-axis villa pairs).

## Types (`scripts/block-face/types/nieuwendammerdijk/`)
| type | faces | pands placed |
|---|---|---|
| `nieuwendam-1935-cottage-dormer`: one-storey brick cottage 4.7 m, gutter 3.25 m, two white casements + dark door at the party wall (paired), flat white box dormer, black tile | 135-163 (143-153) | 6 installed |
| `nieuwendam-oost-villa-5axis`: 10.4 m two-storey brick pair, cream cornice slab at 7.55 m, five tall axes, string course 3.2 m, pedimented dormer over the middle, door in the middle axis | 300-308 | 2 placed, 0 installed (strip-quality gate: cold cast) |

Share of ride-visible frontage covered: 6 pands of 471 (West) = 1.3 %, 0 of 153 (East). The largest coherent family by design is the 1980s infill and the 1930s painted two-storey rows, neither typed yet; both are many small design variants per street.

## Yield (face 135-163 only, 15 pands)
* vetoed before comparison: 0 (after the eaves pin; before it, all 15 read "balconies", see the kit fix).
* compared and held: 9 by review pin (different designs: black-painted ornamental fronts 135-141, taller front 155, painted and black-brick fronts 157-163).
* placed: 6, one run (143-153), installed.
Face 300-308: held 308 (3 columns), 306 (matches by eye; tree and creeper make the columns read 10 vs 5, score 0.57), 300 (wide glazed shopfront); placed 304 and 302; the batch refused the run (strip-quality cold cast rb, dark winter strip). Not installed.

## Kit and pipeline additions (typed, tested, byte-identical when absent)
* `reviewEaves.ts` + `<buurt>-review-eaves.json` (`{face, eavesM, reason}`): a reviewer-measured gutter replaces the 3DBAG eaves in auto-place's per-pand evidence (body band, balcony and palette reads, front evidence) and in the batch strip-quality box. Without it a one-storey dike cottage reads eaves 7 m (3DBAG roof incl. dormers), the body band covers the roof, and every cottage vetoes as "balconies"; the strip-quality gate read sky as "blown, cold cast". `PandEvidence.surveyEavesM` keeps the 3DBAG eaves so the measured-eaves re-pitch (`frontRoof`) still fires. Test `reviewEaves.test.ts`.
* Strip height fix, not code: this dike's 3DBAG ground/panorama height is off by 1.6-2.8 m (the 2021-12-23 and 2022-05-09 panoramas place the cottages 2.4 m up the strip), so intake needs `--camera-height=1.64` (2022-05-09, face 135-163) or `2.75` (300-308, 2019-12-12) to stand the floor on the strip's bottom row. Checked on a 1 m grid. Other dike faces will need the same; the factor is per panorama date.

## What the kit cannot say (Nieuwendammerdijk)
* Painted timber cladding (gepotdekseld / rabat boarding) as a whole facade, and a dike-level entrance (raised floor with steps): not added, no repeated face of 3+ in the survey shows them. A single-house lane per wooden house would be needed.
* The ornamental black-painted fronts with white bands, balustrades and hipped bargeboards (135-141, 157-161, 46-58 left side): white banding on painted brick as a facade pattern, and decorated bargeboards.
* Door positions for dormer-and-door pairs mirror per pand, but the dormer pair (one box across a party wall) is two halves in the kit.
* A reviewer override for the column count when trees hide the facade (306).
* Roof ridge from the photo: the roofs come from 3DBAG (6.3 m ridge), the strip only shows 1 m of roof over the gutter.

## Holds and next steps
* Held with reasons in `nieuwendammerdijk-west-review-holds.json` (9) and `-oost-review-holds.json` (3).
* Surveyed with intake but not typed: 9-43 (largest, 18 pands, painted 2-storey), 12-22 / 24-32 (1980s infill), 46-58, 113-129 (c.1900, arched windows, gabled dormers, a real family of 9 with decorated gable ends), 170-182, 351-355, 387-395, 36-42, 86-90, 98-102. Intake of the other ~15 faces of 3+ pands was stopped (slow); rerun `buurt-survey.ts --intake --only=<faces>` (never --camera-height without grid-checking the floor).
* Integrator must rebuild: `build-chunk-wall-exposure.ts --write`, covers, bake-frontages, buurt pages / explorer-looks, archive strips; `chunk-face-nieuwendammerdijk-135-163-r1.glb` is new.
