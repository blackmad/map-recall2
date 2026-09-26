# Façade model evaluation — which model actually works on Amsterdam

Status: plan, reviewed 2026-09-22. Replaces the five-lane draft ("Plan: which
façade model actually works on Amsterdam"). The review notes at the end say what
changed and why.

Companion docs: [AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](AMSTERDAM_FACADE_GEOMETRY_DESIGN.md)
(point-cloud task list T0–T9), [AMSTERDAM_FACADE_REBUILD_PLAN.md](AMSTERDAM_FACADE_REBUILD_PLAN.md)
(evidence contract), `public/canal-drive/TODO.md` item 10.

## 1. The question and the decision it feeds

**Question:** does any off-the-shelf 2-D façade model find Amsterdam windows and
doors well enough to replace or back up the current photo extraction?

**Decision:** pick one opening detector, or none, as a `streetlevel-measured`
observation source. Everything in this plan exists to make that decision with a
number. Anything that doesn't feed it is out of scope (see §9).

**Decision rule. Fix it before running anything:**

| Metric (on the gold set, §4) | Adopt if |
| --- | --- |
| Opening recall (IoU ≥ 0.5 in wall metres) | ≥ 0.80 |
| Opening precision | ≥ 0.80 |
| Median opening-centre error | ≤ 0.30 m |
| Beats the existing extraction on the same crops | on recall **and** precision |

If no model clears every row, the answer is "none". Record it and stop. Don't
lower the thresholds after seeing results.

## 2. What we have (verified 2026-09-22)

**Photos:**
- 2,857 panoramas in `.cache/city-appearance/shared-panoramas/` (8000×4000
  equirectangular).
- Crops for 2,412 distinct BAG buildings (`<BAGID>_e_<hash>-{full,ground,roof,context}.jpg`).
- Six evidence manifests at
  `.cache/city-appearance/areas/*/panorama-audit/*/evidence/manifest.json`
  (apollobuurt, tuindorp-nieuwendam, jordaan-sample, da-costabuurt,
  da-costa-expansion-550m, da-costa-tranche-400m). Each record carries pose,
  plane, standoff, obliquity and `metricEligible`.
- `review-data/crop-preflight.json` (usable-crop verdicts).
- `review-data/pano-track-priors.json` (36,427 panos).
- `review-data/user-review-2026-09-21.json`: 25 cases **with human notes**.

**Rectification:**
- `rectifyFacade(image, pose, plane, { camera, pixelsPerMetre, maxPixels })`
  (`src/canalRecall/facade/rectify.ts:221`, default `maxPixels` 12e6).
- The cached crops were made in `scripts/da-costa-block/prepare-neighbourhood.ts:150`
  at 45 px/m (full) and 110 px/m (ground), with `maxPixels: 1_400_000`.

**Point cloud:**
- Two 50 × 50 m Oud-Zuid tiles, now in `.cache/pointcloud/`: Museumkwartier
  `filtered_2397_9705` and Willemspark `filtered_2386_9702`.
- 15 buildings have published measured walls (`public/data/pointcloud-facades/v1/`).
- **None of those 15 buildings has a photo crop**: the overlap with the 2,412
  crop buildings is 0.
- The city host (puntenwolk) is still NXDOMAIN.

**Environment:**
- Local: Python 3.11, `inference` 1.6.2, torch + MPS, and the RF-DETR-seg façade
  model cached as a 768×768 ONNX.
- GPU: runpod works, with a $10 balance.

## 3. The key move: point-cloud buildings become 2-D ground truth

The draft split the work into "photos for 100 buildings" and "point cloud for
Oud-Zuid" as two separate studies. That wastes the only metric ground truth we
have. The MLS measures openings as geometry: recesses behind the wall plane, in
metres, with no perspective. Photograph those same façades and every 2-D model
can be scored against **measured** openings instead of against another model.

So: **fetch the panoramas for the 15 point-cloud buildings and rectify them onto
the same 3DBAG wall planes.** That's about 15–30 panoramas from the municipal
panorama API, a one-off network fetch with no GPU spend. The walls then have
both a measured opening set and a photo crop in the same wall-metric frame.

Prerequisites from the geometry plan: T2 (float64 positions) and T4 (no
neighbour leakage) must land first, or the "ground truth" carries a known 3 cm
quantisation and edge contamination.

## 4. Gold set

Two parts, both frozen into `review-data/facade-model-gold/v1/`, which records its
own SHA256:

1. **Measured (≈15 buildings, Oud-Zuid).** Openings from `compileFacade` on
   well-scanned, unclipped walls. A human spot-checks each wall's diagnostic SVG
   (`diagnostic-*.svg`) and marks walls where the measurement is visibly wrong.
   Those walls are dropped, not corrected by a model.
2. **Hand-labelled (≈20 buildings, stratified).** A human draws window/door
   boxes on rectified crops. There are 5 each from apollobuurt,
   tuindorp-nieuwendam, jordaan-sample and da-costa. Where possible, choose the
   buildings from the 25-case user review, which already has human notes. **A
   model never labels its own ground truth.**

Without part 2, the result holds for Oud-Zuid only. Without part 1, the result
depends on how carefully one person labelled.

## 5. Candidate models (reduced from five lanes to two, plus a baseline)

| Lane | Model | Why kept | Licence |
| --- | --- | --- | --- |
| 0 · baseline | existing photo extraction (current recipes) | what we'd replace | ours |
| A · rf-detr-facade | `building-facade-segmentation-instance/4`, cached ONNX | ready now, local, instance masks | CC BY 4.0 (uploader-asserted); ship weights, never pixels |
| B · window-detector | `lck1201/win_det_heatmaps` | window corners and grid rhythm, a different family from A | MIT |

The dropped lanes, and when to revisit them, are in §9.

**Model input resolution matters more than crop resolution.** RF-DETR resizes
to 768 px on the long side. A 6 × 15 m wall at 110 px/m (660×1650) goes in at
about 46 px/m. The same wall at 45 px/m (270×675) is upscaled. So "re-render
at higher px/m" does nothing unless we **tile**. Run both models on overlapping
storey-height tiles (e.g. 768×768 px with 15% overlap), then merge the
detections in wall metres (NMS at IoU 0.5).

## 6. Resolution experiment (the re-render question, made measurable)

Native resolution from an 8000×4000 pano is about 1273·cos(obliquity) / standoff
px per metre along the wall (1273 = 8000 / 2π). That's ~230 px/m at 5 m straight
on, and ~55 px/m at 16 m and 45°. The cached ground strips at 110 px/m are
already upsampled beyond ~11.6 m standoff.

Render each gold-set wall at two settings and score both:

- **R0:** the cached strip (45 px/m full, no tiling).
- **R1:** re-rendered at `min(150, 0.9 × native)` px/m, with `maxPixels`
  raised to 4 M, then tiled.

Adopt R1 only if it raises recall by ≥ 0.05 at equal precision. Put the
re-render in one typed helper, `src/canalRecall/facade/evalCrop.ts` with a
`.test.ts`, so both lanes see identical pixels.

Where a building has alternative records, prefer the smallest
`standoff / cos(obliquity)` whose pano is cached locally.

## 7. Selection and sweep

1. **Gold set (§4):** about 35 buildings. This is where the decision is made.
2. **Sweep:** 100 buildings, run *after* the decision and only for the adopted
   model (or for A and B if both pass). It's for qualitative coverage and the
   demo, not for the decision.
   - Stratify: 25 apollobuurt, 25 tuindorp-nieuwendam, 25 jordaan-sample, 25
     da-costa (all three manifests).
   - Dedupe by `buildingId`.
   - Require a `full` crop that `crop-preflight.json` marks usable, prefer
     `metricEligible`, and prefer a locally cached pano.
   - Exclude the gold-set buildings.
   - Emit a versioned `selection.json` with its SHA256.

## 8. Tasks (in order; each ends in a commit SHA plus command output)

| # | Task | Output | Done when |
| --- | --- | --- | --- |
| 1 | Geometry plan T0, T2, T4 land | commits | `npm run test:point-cloud-geometry` and `npm run test:point-cloud-spike` pass on float64 positions |
| 2 | Fetch and rectify panos for the 15 point-cloud buildings | `.cache/facade-eval/oudzuid/` crops plus a manifest (pose, plane, standoff, pano id/date/url) | every well-scanned wall has ≥ 1 crop, or a recorded reason why not |
| 3 | Rectification helper `evalCrop.ts` (R0/R1, tiling, tile→wall-metre mapping) | module + test | the test round-trips a box from tile pixels → wall metres → tile pixels within 1 px |
| 4 | Gold set frozen (§4) | `review-data/facade-model-gold/v1/` | the human spot-check and labels are done; SHA recorded |
| 5 | Scorer `src/canalRecall/facade/openingScore.ts` | module + test | IoU matching in wall metres, precision/recall/centre error, with explicit denominators; `unknown` ≠ negative |
| 6 | Lane A adapter (Python, local) | `scripts/facade-eval/run_rfdetr.py` → JSON of boxes in wall metres | runs on the gold set for R0 and R1 |
| 7 | Lane B adapter | `scripts/facade-eval/run_windet.py` → same JSON schema | runs on the gold set for R0 and R1 |
| 8 | Score baseline, A and B × R0/R1; apply the §1 rule | `review-data/facade-model-gold/v1/results.json` + a table in HISTORY | the decision is recorded, including "none" |
| 9 | (If adopted) 100-building sweep + comparison page | demo page, Storybook-free static HTML | each building shows the crop with overlays and the baseline; the page states it's qualitative |

Tasks 2–3 and 6–7 can run in parallel in separate worktrees (one per lane). The
integrating agent owns 4, 5, 8, `package.json`, `TODO.md` and `HISTORY.md`.

## 9. Out of scope for this decision (and when to revisit)

- **C · OccFaçade.** No licence is stated, so it can't ship. Use it for ideas
  only. Revisit only if A and B both fail on precision.
- **Zero-shot material model** (MIT). This is a *material* question, not an
  opening question. Run it as a separate study against `wallColourSample.ts` /
  `case-wall-colour.json`.
- **D · DGCNN/PointNet++ on the point cloud.** The geometric classifier already
  measures openings deterministically on the only 15 buildings we have. A
  learned 3-D segmenter can't be scaled until the puntenwolk host returns.
  Revisit when it does, and score it against the same gold set.
- **E · PTv1 on GPU.** It carries the same problem as D, plus a pointops/CUDA
  compile risk. If it's ever run: A4000 community pod, a hard $2 cap,
  `runpodctl pod delete` right after `receive`, and the deletion confirmed with
  `runpodctl pod list` in the report.
- **Canal belt.** None of the six evaluated areas is the Herengracht /
  Keizersgracht / Prinsengracht release, and that's the product target. Once
  the decision is made, check whether release crops exist and add a canal-belt
  stratum to the sweep.

## 10. Risks

- **Domain gap.** A and B were trained on CMP/RueMonge/zju-type façades. The gold
  set measures exactly this gap; that's the point of it.
- **Oud-Zuid isn't typical.** Its wide blocks and large windows may flatter the
  models, which is why the hand-labelled part of the gold set is stratified.
- **Pano/MLS epoch mismatch.** The panorama and scan dates differ, so shopfronts
  may have changed. Record both dates per wall and drop walls where the
  spot-check sees a change.
- **Missing panos.** Many referenced panos aren't cached, and fetching them is a
  network dependency. The gold set and sweep prefer cached ones. Task 2 fetches
  only what it needs, with URLs recorded.
- **Licences.** Ship derived boxes and weights only, never third-party imagery.
  Mapillary is CC BY-SA. Municipal panoramas are CC BY 4.0. Ultralytics is
  AGPL-3.0: don't vendor it.

## 11. Housekeeping

Reconcile HISTORY.md's stale "86 measured walls / 2,051 faces" with the on-disk
`public/data/pointcloud-facades/v1/index.json` totals **by re-running**
`npm run publish:point-cloud-facades` after geometry-plan T2/T4. Quote the new
output, not either old number.

---

## Review notes: what changed from the draft and why

1. **No decision rule.** The draft planned to measure "precision/recall against
   the existing extraction" plus model-vs-model agreement. The existing extraction
   is machine output with 0 audited frontages, so that measures agreement, not
   accuracy. §1 now fixes thresholds up front, and §4 adds a real gold set.
2. **The two halves shared no buildings.** The draft split the photo and point-cloud
   studies, but the point cloud is the only *measured* opening ground truth we
   have, and 0 of its 15 buildings had photo crops. Fetching their panos (§3)
   turns the Oud-Zuid deep-dive into the scoring set for the photo models. That's
   the biggest change.
3. **Re-rendering was treated as a free win.** The cached-ONNX RF-DETR runs at
   768 px, so a higher-px/m crop gets downscaled again unless it's tiled. The
   draft's native-ceiling formula also left out obliquity. §6 makes re-rendering
   an A/B experiment with an adoption threshold.
4. **Five lanes were too many.** C has no licence, so it can't ship. D and E
   answer a question the geometric classifier already answers on the same 15
   buildings, and E adds GPU spend and a compile risk. Cut to baseline + A + B.
5. **The 100-building sweep was presented as evaluation.** Without labels it's a
   demo. It now runs after the decision, as coverage and a demo only.
6. **The float32 and edge-leak defects** in the point-cloud path (geometry plan
   T2/T4) would contaminate the ground truth, so they're now prerequisites.
7. **Canal-belt blind spot.** None of the six areas is the release canal belt,
   which is the product target. It's added as a follow-up stratum.
8. **The draft's open questions are resolved here.** The split: photos are scored
   against point-cloud truth in Oud-Zuid plus hand labels elsewhere. Re-render:
   an A/B test, not an assumption. Model set: A + B. GPU: deferred, $2 cap if
   ever. Lane launch: staged, gold set first.
