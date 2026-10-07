# OCCII feedback candidate review

Candidate for feedback `56aad0df-0be9-478c-812a-e99f9e9d9086`, claimed by coordinator. Isolated checkpoint only; no acceptance or resolution yet.

Model SHA-256: `daa846481f1d36932a0b64008446f8b0694949a3a27358b6cd14865f0988357b`; 2,119 triangles, 32,812 bytes. Only OCCII branch of independent-cinemas-builders.ts changed.

`node scripts/landmarks/occii-feedback-check.mjs` passes against saved baseline/candidate exports under artifacts/occii-feedback-20261007. It reproduces old overhang/tripod first hits, verifies their removal, checks exposed fan/collar/roundel, and verifies unchanged other materials. This is decoded mesh evidence, not visual acceptance.

Preserved baseline and candidate views:
- artifacts/occii-feedback-20261007/baseline/occii-cpu-front.png
- artifacts/occii-feedback-20261007/baseline/occii-cpu-oblique.png
- artifacts/occii-feedback-20261007/candidate/occii-cpu-front.png
- artifacts/occii-feedback-20261007/candidate/occii-cpu-oblique.png

CPU comparison: upper crossbar no longer protrudes at either side; long red tripod removed; gold radial motif and short hanging collar occupy roundel area above window heads. Window groups and remaining facade preserved. CPU crop includes deep rear roof surfaces because orthographic helper does not clip its depth; pre-existing rear roof shape is outside this feedback repair and requires GPU comparison at actual perspective before conclusions.

Source comparison: read large restored operator photo staged in root artifacts/occii-feedback-20261007/operator-2014-facade.jpg alongside candidate front. Source fan has carved leaf/petal detail; candidate uses original flat-color bars as a bounded approximation. Exact count and dimensions are not surveyed. Raw captures and architectural assertions are inventoried in occii-feedback-sources.json. Private source originals published in a311883a016366f26d1e81125e4e20a248ea82c4, models/occii/. Revised CPU evidence still needs follow-up archive before model commit.

GPU review pending coordinator grant. Replay saved feedback camera theta=-0.049296875, phi=1.5, distance=51.150517389373825, target=[-0.00991511344909668,4.945000076293944,0.3473949432373047], then default higher view and four lower rotations. Check front fan/roundel visibility, no upper bar beyond windboards, same native massing/roof, live-game frontage and retained neighbors, and original POI route/pin/card surfaces. Resolve cloud note only after hosted behavior passes.

Shared asset check was attempted and correctly reports stale OCCII fingerprint (99ed270e19f3ac00 versus candidate 5cd11c091478b571), because isolated shared metadata was restored per ownership constraints. Coordinator regeneration/integration is required before that check can pass; this is not model acceptance.


## Preserved failed candidate and corrected exposure

Independent review of first candidate SHA 5cd11c091478b571 found five of 27 rays blocked by retained red windboard bosses. Baseline failed export, images and independent raw rays remain under artifacts/occii-feedback-20261007/failed-first-candidate/. The first narrow three-ray worker check missed this overlap; it was replaced with full sampling.

Revised fan retains its original shallow plane and inner/outer radii, while its nine petal angles are unequal to avoid the retained boss faces. This remains a photo-guided carved-fan simplification, not an exact reproduction. No bosses were removed or blanket material exemptions added, and the roundel remains ahead/clear. 81 fan rays (all nine spokes × fractional lengths 0.25/0.5/0.75 × frontal/±0.55 rad) pass exposed gold first hits. Other materials remain unchanged. Independent re-review and native acceptance remain pending.


Second independent width pass exposed one of 243 hidden gold samples at spoke2's inner edge, despite passing centerlines. Preserved SHA 9f694d1a export and raw independent width rays in failed-second-candidate/. Rotated that spoke only from 0.9 to 0.98 radians. The updated focused check samples all nine spokes at three lengths and three widths (−0.045/0/+0.045m), each frontal and both independent oblique directions. All 243 fan first hits now pass gold with no red/material exemptions. Exact revised candidate still requires independent verdict and native views; no claim of whole-facade fidelity.

## Coordinator acceptance

Final production `daa846481f1d36932a0b64008446f8b0694949a3a27358b6cd14865f0988357b` is locally accepted after root and fresh independent source/gallery/native review. All243 fractional-width/length/oblique fan probes pass, alongside reported overhang/tripod regression, preserved other materials, actual physical sourced card, genuine route/pin, exact masks/two resident neighbors and real failed-download fallback. Both failed fan candidates remain archived. Accepted private source/evidence `cb67adebb70c3c70e28fef91cb64398bd2f0c110` is pushed before public model commit. Feedback remains in-progress until exact hosted verification. Original rear roof is retained and outside this bounded repair.
