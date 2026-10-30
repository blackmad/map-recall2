# Photo evidence guard (#120) — lane state, 2026-10-30

Branch `lane/evidence-guard-20261030`. Two typed gates. Both are calibrated on named cases, and every threshold is explained from the measured spread.

## 1. Strip evidence gate (block-face batch)

- `src/canalRecall/blockFace/stripEvidence.ts` (+ test, + `fixtures/strip-evidence-calibration.json`).
- Signal: the strip is rectified a few metres past the 3DBAG roof. If the camera saw the front, the band over the roof (roofMax + 0.7 m up to the strip top) shows open sky in nearly every column. If it saw a nearer wall, a fence or a tree, that object is magnified past the strip top. The gate is `skyCols >= 0.75`, where a column counts when at least 25 % of its pixels are blue sky, or are smooth and lighter than the facade (or near-white).
- Calibration on spans:
  - The 4 no-front runs read 0.03–0.59. The highest, 0.59, is the fence-and-tree span of Bloemgracht 53-95.
  - The 24 reviewed installs (62 spans) read 0.95–1.00.
  - The limit, 0.75, sits in the middle of that gap.
- Measured but not gated, because they do not separate the good runs from the bad:
  - `measureSkyline` confidence: its fixed sky colour misses grey overcast and reads 0 on good De Pijp strips.
  - Skyline reach.
  - Camera distance and obliquity: the bad akoleien/lelie runs are 22–29 m away at 36–43°, and the good helst-51-67 run is 18–26 m at 40–44°.
  - Foliage: the good bloemgracht-138 reads 0.28, the bad fence span 0.26.
- `auto-place.ts` runs the gate by default and `--no-evidence-gate` turns it off. `decidePand` holds a failing pand at stage `evidence` before the type match and the likeness score. Without the field, decisions come out byte-identical.
- Population: over all 382 staged runs in type-libraries-20261029, 277 of 2,772 spans fail, in 88 runs. These are mostly Jordaan narrow-street crops. The false rejects are strips with dense bare tree crowns over the roofline (Ceintuurbaan, Tweede Jan Steen/Toussaint).
- Tools: `node --import tsx scripts/block-face/evidence-gate.ts --strips=<dir> --calibrate [--sheet=out.jpg] [--json=out.json]`.

## 2. Thumbnail gate (per-pand modern walls)

- `src/canalRecall/buurtProfiles/thumbEvidence.ts` (+ test).
- `scripts/buurt-profiles/thumb-gate.ts` writes a `gate` field on each sample in the staging `pano-samples-modern.json`. `derive.ts` drops modern samples whose gate failed; samples without a gate behave as before.
- Gate:
  - shadow (L* < 30, C* < 8) at most 0.25, the p90 of the reads whose family agrees;
  - the sampler's family must agree with derive's material. 1,886 of the 3,334 are colourless dark (L* 31, C* 3) "render" reads that derive drew as brick, after a chroma lift gave them an invented hue.
  - Pitch and distance are bounded only at the sampler's own range, because the measured brick L* and the disagreement rate stay flat across pitch and distance bins.
- Haarlemmer Houttuinen 0363100012185423 is rejected (shadow 60 %, disagree).
- Re-derived to `staging/buurt-profiles/gated/` only: 1,237 of 3,251 walls survive (520 brick, 717 paint). Of the 12 #117 focal pands, only Govert Flinck 1990 keeps its own wall.

## Not done / next

- Per-pand walls are still unpublished. My recommendation is in the lane report: do not ship yet.
- The strip gate does not run inside `batch.ts` as a separate report column. It acts through `auto-place.ts` holds.

## #117 12-spot render (off / gated / ungated)

The three renders are under `staging/evidence-guard/gap/{off,gated,ungated}`, and the sheets are `gap-sheet.jpg` and `gap-changed.jpg`. They use local bundle rebuilds only; the bundles and the JSON were restored afterwards.

- Gated walls are close to identical to off: 7 spots differ by 0 px, and the largest change is 1.2 % of pixels, at Derde Oosterpark.
- Ungated walls change Haarlemmer Houttuinen and Govert Flinck by 5.6 % of pixels each. Both turn into dark or near-black brick, which is wrong against the photo (light render with balconies).
- So the gate removes the visible failures, but the gated set adds almost nothing at these spots.
- The AA05 thumbnail sheet shows that 2 of 5 passing samples are views of the wrong building or of scaffolding sheeting.
- Recommendation: keep `modern-pand-walls.json` empty. The next step is a target check that projects the BAG footprint into the thumbnail and tests whether the box is on that pand, plus a scaffolding/sheeting reject.
