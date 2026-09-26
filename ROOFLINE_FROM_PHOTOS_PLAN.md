# Rooflines from photos: task plan

Status: plan, written 2026-09-22. It is a task spec under `public/canal-drive/TODO.md`
item 10. Companion docs: [AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](AMSTERDAM_FACADE_GEOMETRY_DESIGN.md)
(point-cloud tasks T0–T9), [FACADE_MODEL_EVALUATION_PLAN.md](FACADE_MODEL_EVALUATION_PLAN.md)
(openings; its lessons are applied here).

## 0. Start here: the project's own strip cutter, with headroom (tasks A0–A5)

The owner's direction (2026-09-22): **build on the existing panorama strip
cutter**, and on the canal-belt buildings it already selected. Order: re-cut
strips with sky headroom → segment → edge-snap → roofline profile → reconcile
into 3DBAG (§7) → render → owner review. The scan comparison (§1–§6) validates
the same method on Oud-Zuid. It is not the starting point.

### What exists (verified 2026-09-22)
- **Strip cutter:** `scripts/facade-twin/build-strip-set.ts` with
  `panorama-render.ts` (`rectifyWall`) and `frontage.ts`, **only on the unmerged
  branch `feat/amsterdam-building-twin`** (worktree
  `.worktrees/amsterdam-building-twin`, clean, 124 commits ahead of `main`).
  Its gates are the reason to reuse it rather than write a new one: the wall is
  a chosen frontage, visibility is sampled at nine points, source pixel density
  is measured (no upsampling), leaf-off views are preferred, and a missing lens
  height is inferred (`lensHeightNap`) rather than silently becoming −43.5 m.
- **Output today:** 91 rectified strips plus a manifest in that worktree's
  `.cache/facade-twin/strips-confident/`, grachtengordel-west.
- **Why the rooflines are missing:** line 155 renders the wall from
  `ground − 0.8` to **`top + 0.5`**, where `top` is the 3DBAG height, and 3DBAG
  has no gables. On the 6 strips with saved masks, 23–63 % of columns are
  building right up to the top edge in 3 of 6.
- **Why not the existing segmentation for rooflines:** Roboflow
  `amsterdam-facade/2` (512 × 512 stretched input, trained for facade parsing)
  labels **bare winter trees as sky** (Keizersgracht 127: a "sky" region down the
  middle of the brick facade) and gives a boundary that sags into roof tiles
  (Herenstraat 40, roughly 0.3–0.7 m by eye). Its window and door masks look fine. It
  stays the baseline for rooflines and remains the opening model. **Its local
  weights are gone:** `/tmp/cache/models-cache` holds only dangling symlinks.
  Restoring them needs the owner's `ROBOFLOW_API_KEY`.
- **Existing masks** for comparison: `public/canal-drive/facade-photo-review/local/*/`
  (about 9 buildings).

### A0: Re-cut the strips with headroom (DeepSeek; wave 1; in the building-twin worktree)
Branch `feat/roofline-strips` from `feat/amsterdam-building-twin`, worktree
`.worktrees/roofline-strips`. The panorama cache is the building-twin
worktree's `.cache/facade-twin` (use it by absolute path; don't copy it).
1. Add flags to `build-strip-set.ts`, keeping today's behaviour as the default:
   `--headroom-m=<n>` (replaces the `+ 0.5`; default 0.5), `--out=<dir>`,
   `--pands-from=<manifest.json>` (re-cut exactly those pand IDs), and
   `--views-per-wall=<n>` (keep the best *n* qualifying views instead of
   `break` after the first; default 1). Require **≥ 3 m between capture positions**
   so the extra views are genuinely different.
2. Put the exact frame in each manifest record, so nothing is reconstructed
   later from rounded sizes: the wall RD endpoints (`start`, `end`, and which is
   the strip's left edge), `bottomNap`, `topNap`, the horizontal margin in
   metres, the exact rendered pixels per metre in x and y, the panorama ID,
   the lens verdict, and the git SHA of the generator.
3. The vertical density gate (cos²φ at the top of the wall) must be evaluated
   at the **new** top. Report how many walls drop out because of it.
4. Run: `--pands-from=<old strips-confident manifest> --headroom-m=6
   --views-per-wall=3 --out=.cache/facade-twin/strips-roofline-v1`.
Done when: the report lists walls, views per wall, drop-outs by reason, and
before → after share of top-clipped columns (use the sky/building test from A2
on a quick luminance check, or just the new masks once A1 runs). Include a contact
sheet PNG. **If the vertical density gate drops more than a third of the walls,
stop:** the integrator decides whether to relax it for the roof band only.

### A1: Segmentation for sky / building / occluder (DeepSeek; wave 1)
1. `scripts/roofline-eval/segment.py` (venv under `$ROOFLINE_CACHE/roofline-eval/venv`,
   pinned `requirements.txt`) runs **Mask2Former, Mapillary Vistas semantic**
   (`facebook/mask2former-swin-large-mapillary-vistas-semantic`) on each strip,
   **tiled** so the long side isn't squashed below ~1024 px. It writes the §4
   label contract. Vegetation, pole, wire, traffic sign, vehicle and person map to
   `3` (occluder). Record the class mapping in `provenance.json`.
2. Rectified strips are near-frontal (obliquity ≤ 25° by the cutter's gate), so
   segmenting them directly is acceptable. Record the obliquity per strip, so a
   later analysis can check whether error rises with it.
3. The same script with `--method=af2` converts existing `amsterdam-facade/2`
   masks to the contract (`background` → 255) for the baseline. It doesn't rerun
   the model unless the owner has restored the weights.
Done when: masks for all A0 strips, seconds per strip, and a contact sheet (strip,
mask, and the Vistas vs af2 difference on the 9 buildings that have both).

### A2: Edge snapping and roofline profile (Sonnet; wave 2)
1. `src/canalRecall/facade/stripRoofline.ts`: per column, find the coarse
   boundary (the lowest building pixel with only sky above it, where the run is ≥ 4 px),
   then **snap** it to the strongest vertical luminance gradient within ±8 px
   (≈ ±0.2 m at 40 px/m), with the sign building-dark-below/sky-bright-above.
   Keep the coarse boundary if no gradient clears a threshold, and record which
   one was used.
2. Return `null` when the top row is building (still clipped), an occluder
   (`3`) or unknown (`255`) touches the transition (±3 px), or the column has
   no sky.
3. Convert with the A0 frame to the §3 convention (`along` from `start`, `up`
   in NAP), then resample to 0.10 m and label the shape with the §3 rule.
4. Multi-view: with ≥ 2 views, keep the columns where the views agree
   within 0.25 m (median of them) and set the rest to `null`. This is R6, done
   here for strips.
5. Tests: a synthetic step gable with a blurred edge is recovered to within
   2 px; a tree at the transition gives `null`; two views that disagree
   give `null`.
Done when: profiles plus an overlay per wall (coarse boundary, snapped boundary,
consensus) and a table of per-wall coverage.

### A3: 3DBAG LoD2.2 for the strip buildings (DeepSeek; wave 1)
Fetch the LoD2.2 CityJSONFeatures for the A0 pand IDs into an offline cache
(same pattern as T3, `scripts/pointcloud/`), and pin the 3DBAG version. The
wall endpoints now come from the A0 manifest, so no matching is needed. Check
that each A0 wall lies on a 3DBAG `WallSurface` of that pand (within 0.5 m
and 5°). A mismatch → mark it and exclude it.

### A4: Reconcile, render, review (§7 G1–G4, on the canal-belt walls)
Run G2 → G1 on the A2 consensus profiles with the A3 geometry, then G3
render, then the G4 owner yes/no review, **on these canal-belt buildings
first**. Report the relation counts (`agree` / `rises` / `below` / `unknown`). A
high `below` count points at a vertical datum error in the strips, not at
3DBAG.

### A6: Owner grading at scale (DeepSeek; wave 2) and more strips
Decision 2026-09-22: **the owner grades the photo rooflines directly.** That
makes grading, not the scan answer key, the acceptance test, so coverage is no
longer capped by the ~10 scan buildings. The scan check (A5) stays as a coarse
check for systematic bias only.

1. **Grading page** `public/canal-drive/roofline-review.html`, modelled on the
   existing registration review desk (`public/canal-drive/facade-registration-review/index.html`,
   commit `97146d8`): one wall at a time, showing each view's strip with the coarse
   (thin) and snapped (thick) roofline, the consensus profile, and the fitted gable
   outline (G2) when present. Grades: **1 right · 2 close · 3 wrong · 4 can't
   tell**, an optional note, and a "wrong because" chip (clipped / tree / neighbour
   / set back / other). Keyboard-driven (number keys, ←/→), so one grade takes
   seconds. State is kept in localStorage with **Export / Import JSON**; the
   export is bound to the profile hash, so a grade can't be applied to a changed
   profile. The owner commits exported grades to `review-data/roofline-grades/`.
2. **Data builder** `scripts/roofline-eval/build-review-data.ts` copies
   thumbnails and profile JSON from the cache into
   `public/canal-drive/roofline-review/local/` (gitignored) so the dev server can
   serve them. Until A2 lands, it accepts a fixture in the A2 output format.
3. A later pass adds a second stage per wall: the in-game render (G3) next to the
   photo, graded the same way. That is the G4 recognition test.
4. **More strips:** after A0 v2 is accepted, rerun the cutter without
   `--pands-from` and with `--count=400` (the area registry has 5,757 buildings),
   same headroom and views flags, into `strips-roofline-v3`.
Done when: the page loads on port 5197 with the fixture, grading 10 walls by
keyboard takes under a minute, and export → import round-trips.

**A2 output format (so A6 can build against it now):**
`$ROOFLINE_CACHE/roofline-eval/strip-profiles/<pandId>.json` =
`{ pandId, address, wall: {start, end}, views: [{ file, panoramaId, capturedAt,
coarsePx: (number|null)[], snappedPx: (number|null)[], profile: [along, upNap|null][] }],
consensus: [along, upNap|null][], shape, profileSha256 }`.

### A5: Validation against the scan (Oud-Zuid)
The building-twin cutter is scoped to grachtengordel-west. For Oud-Zuid, apply
the same headroom change to `scripts/facade-eval/panos/fetch-oudzuid-crops.ts`
(its `topZ = oz + wall.frame.wallTop`, line 173) and run A1 → A2 on those crops.
Score them against the R1 scan gold with R5. This is the measured error for
the exact method used in the canal belt. The other models (SegFormer, SAM 3)
run **only if Vistas plus snapping fails the §1 rule**. The luminance
`skyline.ts` stays S0, the floor.

## 1. Question, decision, rule

**Question:** can street-panorama segmentation recover a facade's roofline
(gable, step, cornice) accurately enough to use it in the game where no
point-cloud scan exists?

**Why it matters:** 3DBAG carries no gables (0 of 895 canal-belt buildings have
a wall above the roof). The municipal point cloud measures them, but city-scale
access is blocked (`files.lidar.data.amsterdam.nl` is NXDOMAIN). Panoramas cover
the whole city. If photos pass this test, gables no longer depend on the scan.

**Decision:** adopt one photo roofline method as a `streetlevel-inferred`
roofline source, or adopt none.

**Decision rule. Fixed before anything runs; don't change it after seeing results:**

| Metric (scored elevations, §3) | Adopt if |
| --- | --- |
| Median over elevations of the per-elevation median column error \|photo − scan\| | ≤ 0.30 m |
| Median peak-height error | ≤ 0.50 m |
| Shape agreement (flat / sloped / shaped, same definition as the scan) | ≥ 80 % |
| Abstention (elevations with < 50 % of columns reported) | ≤ 30 % |
| Beats the existing baseline (§4, S0) | on column error **and** shape agreement |

Each method must meet every row. Abstaining is allowed, but it can't be used
to game the rule, which is why abstention has its own row.

**Honest limits, stated up front:** the gold set is small (§3) and comes from
Oud-Zuid, not the canal belt. A pass means the method is *worth a canal-belt
pilot with human spot checks*. It does not certify the method. A fail with the
diagnostics in §6 still tells us *why*.

## 2. Lessons from the openings evaluation (don't repeat them)

1. **Look at the gold before scoring.** The openings gold had 52 of 60 walls
   under 3 m wide (3DBAG wall slices), 40 of 60 with no openings, and all 60
   marked `spotCheck: "pending"`. Here, every gold elevation gets an overlay
   and the integrator checks it (task R1) before any model is scored.
2. **Score whole elevations, not wall slices.** Merge collinear slices of the
   same pand into one elevation with `buildElevations` in
   `src/canalRecall/facade/elevations.ts`.
3. **Separate alignment error from model error.** Every score comes with a
   diagnostic best-vertical-shift and flip check (R5). If a shift fixes the
   result, the problem is registration, not the model. **Don't fit per-wall
   offsets to the gold;** only global camera-model fixes are allowed.
4. **Crops must include the sky.** The existing Oud-Zuid crops stop at 3DBAG
   `wallTop` (`scripts/facade-eval/panos/fetch-oudzuid-crops.ts:173`), which
   cuts off exactly the part above the roof. Views here get ≥ 6 m of headroom.
5. **Segment the perspective image, not the rectified strip.** The models
   are trained on normal photos. Sample their masks from the world geometry
   (R4) instead of rectifying first.
6. **Centre and shape metrics are computed on every scored elevation**, not
   only on elevations that already matched.

## 3. Gold set: measured rooflines from the point cloud

Source: the two demo tiles in `.cache/pointcloud/` (Museumkwartier
`filtered_2397_9705`, Willemspark `filtered_2386_9702`), fetched by
`scripts/pointcloud/fetch-demo-tiles.ts` (T1) with hashes pinned there.

What is published today isn't enough. `public/data/pointcloud-facades/v1/*/manifest.json`
has `rooflineShape`, `rooflineRange` and a `gable` polygon for only a few walls.
It has no per-column profile. Counts (Museumkwartier 21 walls, Willemspark 39):
only 10 walls are ≥ 2.5 m wide, of which 6 are `shaped`. R1 fixes this by
merging slices into elevations and exporting the profile.

Frame convention for **every** file in this plan (it avoids the offset bugs of
the openings run):
- `along`: metres from `plane.start` towards `plane.end`, on the horizontal
  line through them.
- `up`: **absolute NAP metres**. Never relative to `baseZ` or `wallTop`.
- Profiles are sampled every `sampleM = 0.10` m; a missing column is `null`.

## 4. Methods under test

| ID | Method | Notes |
| --- | --- | --- |
| **S0 baseline** | Existing in-repo heuristic: `src/canalRecall/facade/skyline.ts` (`skyline`, a luminance-based sky/building boundary per column, added 2026-09-03 for registration). | A zero-cost floor. A model that can't beat a brightness threshold isn't worth adopting. |
| **S1** | **Mask2Former, Mapillary Vistas semantic** (`facebook/mask2former-swin-large-mapillary-vistas-semantic`), tiled, plus A2 edge snapping | The method under test. Trained on street-level images; separates sky from vegetation. |
| S2 | Roboflow `amsterdam-facade/2` (existing masks) | Baseline. `sky` → 1, `building`/`window`/`door` → 2, `background` → 255. Known to call bare trees sky. |
| S3 | SegFormer ADE20K (`nvidia/segformer-b5-finetuned-ade-640-640`) | **Only if S1 fails.** Cheap second opinion. |
| S4 | SAM 3 with the text prompts "sky" and "building" | **Only if S1 fails.** Sharp edges. Weights may be gated on Hugging Face. **If gated, stop and report; a human accepts the licence.** |
| aux | Depth Anything V2 (small) | Only in R6, as a tie-breaker for set-back edges. It is not a roofline source. |

Confirm every Hugging Face ID with a real download before hardcoding it
(record the sha256). No paid or hosted inference. Everything runs locally on
Apple MPS or the CPU.

Mask label contract (PNG, uint8, same size as the view): `0` other, `1` sky,
`2` building (including roof), `3` occluder (vegetation, pole, wire, vehicle,
person), `255` unknown. S0 emits only `1` / `2` / `255`.

## 5. Tasks

Rules for every task:
- Leaf agents work in their own worktree and branch: `.worktrees/roofline-rN`,
  branch `feat/roofline-rN`, created from `feat/amsterdam-facade-rebuild`.
- **The cache isn't copied into new worktrees.** Read inputs from
  `ROOFLINE_CACHE`, which defaults to
  `/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache`.
  Write outputs under `$ROOFLINE_CACHE/roofline-eval/`.
- New logic goes in typed `src/canalRecall/facade/*.ts` with a `*.test.ts`.
  Python is only for model inference. Scripts go in `scripts/roofline-eval/`.
- **Don't edit** `package.json`, lockfiles, `TODO.md`, `HISTORY.md` or
  generated bundles. List any npm script you want added in your report.
- End with: commit SHA, the exact commands run and their output, and **one PNG
  overlay** per task showing the task's result on real data (path in the
  report). No overlay means the task isn't done.
- If a premise is false (a file moved, a hash doesn't match, a model is gated),
  stop and report. Don't improvise around it.

### R1: Gold roofline profiles (Sonnet; wave 1)
Depends on: tiles in `.cache/pointcloud/`.
1. For each tile, rebuild the wall measurements the way
   `scripts/pointcloud/measure-tile.ts` does (reuse it; don't fork the logic).
2. Group the well-scanned walls by pand. Merge collinear adjacent walls with
   `buildElevations` (default 0.75° tolerance) into elevations. Keep the
   `surfaceIds[]` that make up each one.
3. For each elevation, rasterise the cloud in the elevation's frame and run
   `wallSilhouette` (`src/canalRecall/facade/pointCloudGeometry.ts:271`). Emit a
   profile at 0.10 m in the §3 frame, plus `shape` using the **same** rule as
   the manifest (peak ≥ 0.5 m above both ends → `shaped`), `peakUp`, `eaveUp`,
   and a coverage fraction.
4. Keep elevations ≥ 2.5 m wide with profile coverage ≥ 70 %. Write
   `review-data/roofline-gold/v1/measured.json` plus `.sha256`. Include the
   `plane` (`start`, `end`, `baseZ`, `topZ`) for R2.
5. Render `review-data/roofline-gold/v1/overlays/<elevationId>.png`: the
   point-cloud elevation image with the profile drawn on it.
Done when: the test covers the merging and the profile frame on a synthetic
case; the report states before → after counts (walls → elevations, shaped
count) and lists every elevation with its width and shape. **The integrator
reviews every overlay and records `spotCheck: ok|reject` per elevation before
R5 scores anything.**

### R2: Multi-view perspective views with headroom (DeepSeek; wave 1)
Depends on: nothing (the gold `plane` is only needed at the end; start from the
wall planes in `.cache/facade-eval/oudzuid/manifest.json`).
1. For each elevation, select up to **3** panoramas: the best by standoff and
   obliquity (≤ 45°), from at least 2 distinct capture positions ≥ 3 m apart.
   Prefer different dates, and record `panoramaDate`. Reuse the selection and
   download code in `scripts/facade-eval/panos/fetch-oudzuid-crops.ts` and the
   pose fields it records (`pose`, `publishedOrientation`). The equirectangular
   files already cached in `.cache/facade-eval/oudzuid/panoramas/` count.
2. Add `src/canalRecall/facade/perspectiveView.ts`: build a pinhole view
   (≈ 60° vertical FOV, 1024 px on the long side) from an equirectangular image,
   aimed at the elevation centre, pitched up so the frame spans `baseZ − 1 m` to
   `topZ + 6 m`. Export `worldToViewPixel(view, [x, y, z])`. Use the existing
   `worldToEquirectangularPixel` / `CameraModel` in
   `src/canalRecall/facade/rectify.ts` for the equirectangular side; **don't
   write a second camera convention.**
3. Test: a world point reprojects to within 0.5 px after the view → equirect →
   view round trip; a point behind the camera is rejected.
4. Write `$ROOFLINE_CACHE/roofline-eval/views/<elevationId>/<panoramaId>.jpg`
   plus `.json` (intrinsics, world pose, source panorama sha256, date).
5. Overlay: for 5 elevations, draw the 3DBAG wall outline and the point-cloud
   `wallTop` line on the view.
Done when: the report states the number of elevations with ≥ 2 views, and the
overlays show the projected wall outline landing on the photographed building.
**If it visibly misses, stop and report**, because that is the registration
problem and nothing downstream is valid.

### R3: Segmentation adapters (DeepSeek; wave 1)
Depends on: nothing (develop on any cached panorama view).
1. `scripts/roofline-eval/segment.py --method s1|s2|s3|aux --views <dir> --out <dir>`
   writes one mask PNG per view in the §4 label contract, plus
   `provenance.json` (model ID, revision, sha256, torch version, device, seconds
   per image). The class mapping per model is explicit and written into the
   provenance.
2. S0 adapter in TypeScript: `scripts/roofline-eval/segment-s0.ts` runs
   `skyline()` on each view and writes the same mask contract (sky above the
   boundary, building below, `255` for `null` columns).
3. Venv: `$ROOFLINE_CACHE/roofline-eval/venv/`, set up with `uv` like
   `scripts/facade-eval/README.md`. Pin the versions in
   `scripts/roofline-eval/requirements.txt`.
Done when: all methods run on 10 views, with the timing and an overlay grid
(views × methods) in the report. S3 gated → report and continue with the rest.

### R4: Mask → roofline profile in wall metres (Sonnet; wave 2)
Depends on: R2 (views), R3 (masks).
1. `src/canalRecall/facade/photoRoofline.ts`. For each column `along` (0.10 m)
   of an elevation, walk the vertical world line
   `(x(along), y(along), z)` from `eaveUp − 2 m` to `topZ + 6 m` in 5 cm
   steps and sample the mask via `worldToViewPixel`. The roofline is the lowest
   `z` above which every sample is sky. Return `null` when the transition pixel
   (± 2 px) touches `3` or `255`, when the column never shows sky, or when it
   leaves the frame.
2. No rectification step. This samples the camera image directly, and is
   correct for edges lying in the wall plane. Set-back edges are R6's job.
3. Tests on a synthetic view: a known gable is recovered to within one sample;
   an occluder yields `null`, not a low roofline.
4. Script `scripts/roofline-eval/extract.ts` writes
   `$ROOFLINE_CACHE/roofline-eval/profiles/<method>/<elevationId>/<panoramaId>.json`.
Done when: overlays for 5 elevations show the photo profile (per method) and
the scan profile on the view.

### R5: Scorer and pre-registered report (DeepSeek; wave 1 for code, wave 3 to run)
Depends on: the R1 schema (code); R1 + R4 outputs (run).
1. `src/canalRecall/facade/rooflineScore.ts` implements the §1 metrics with
   explicit denominators, on single-view and consensus (R6) profiles alike.
2. Diagnostics, reported next to the metrics and **never used for the
   verdict**: best global vertical shift (±1.5 m), per-elevation best vertical
   shift, and error after an `along` flip. Split by leaf-on/leaf-off (panorama
   month Apr–Oct vs Nov–Mar).
3. `scripts/roofline-eval/score.ts --write` appends to
   `review-data/roofline-gold/v1/results.json`. It skips gold elevations with
   `spotCheck !== 'ok'`.
Done when: unit tests cover a perfect match, a 0.4 m bias (fails the first row,
and the diagnostic finds the shift), a flipped profile and full abstention.

### R6: Multi-view consensus (Sonnet; wave 3)
Depends on: R4.
1. In `photoRoofline.ts`, combine ≥ 2 view profiles per elevation: take
   the median where the views agree within 0.25 m, and `null` where they
   disagree. Report per elevation how much of the edge is in-plane vs set back.
2. Optional: where views disagree, use `aux` depth to tell whether the
   silhouette pixel is further than the wall plane + 1 m (set back → `null`).
   Adopt it only if it improves R5 on a held-out half of the elevations.
Done when: R5 is run for each method in single-view (best view) **and** consensus
form.

### R7: Gable classification and review page (DeepSeek; wave 3; dev port 5197)
Depends on: R4.
1. Feed scan and photo profiles through `gableFeatures` / `classifyGable`
   (`src/canalRecall/facade/gable.ts`). Report the type agreement table
   (informative only; not in the §1 rule).
2. A static page `public/canal-drive/roofline-eval.html` that shows, per elevation:
   the views, the masks per method, scan versus photo profiles and the scores.
   The integrator wires any bundle build.
Done when: the page loads with all elevations on port 5197 (desktop and phone
width screenshots in the report).

### R8: Decision (integrator)
Run R5 for every method. Check the overlays, apply the §1 rule, and write the
verdict with its numbers and diagnostics into `HISTORY.md`, and move `TODO.md`.
- **Pass:** next step is a canal-belt pilot on one Herengracht block, with
  spot checks by a human, feeding `gable.ts` into the game path.
- **Fail with a big diagnostic shift:** it's a registration problem. Fix the
  camera model globally and rerun once.
- **Fail otherwise:** record it and stop.

## 6. Execution plan

| Wave | Tasks (parallel) | Agent |
| --- | --- | --- |
| 0 | Superseded by the execution plan at the end of §7. | |
| 1 | R1 gold · R2 views · R3 adapters · R5 scorer code | Sonnet · DeepSeek · DeepSeek · DeepSeek |
| 1→2 gate | Integrator merges and **reviews R1 and R2 overlays**; marks `spotCheck`. Stop here if R2 shows misregistration. | integrator |
| 2 | R4 projection | Sonnet |
| 3 | R6 consensus · R7 page · R5 run | Sonnet · DeepSeek · integrator |
| 4 | R8 decision | integrator |

Model routing: **Sonnet** takes the tasks where a quiet geometry mistake
invalidates everything (R1, R4, R6). **DeepSeek V4.1 Flash via opencode** takes
the well-specified plumbing (R2, R3, R5, R7). The integrator (Opus) owns
merges, gold spot checks, `package.json`, `TODO.md`, `HISTORY.md` and the
verdict.

Launching a DeepSeek lane (the opencode MCP server is broken, so use the CLI;
run it in the background):

```sh
git worktree add .worktrees/roofline-r2 -b feat/roofline-r2 feat/amsterdam-facade-rebuild
cd .worktrees/roofline-r2 && opencode run -m opencode-go/deepseek-v4.1-flash --title "roofline R2" \
  "Read ROOFLINE_FROM_PHOTOS_PLAN.md. Do task R2 only, following the rules at the top of §5. Finish with the commit SHA, commands and output, and the overlay path."
```

Launching a Sonnet lane: the Claude Code Agent tool with `model: sonnet` and
the same prompt, in its own worktree.

Budget: local compute only, no paid inference. Expected runtime per wave: under
an hour. Anything longer means a stop-and-report.

## 7. Reconciling a roofline into 3DBAG geometry (tasks G1–G4)

Finding the skyline is half the job. The output that matters is **3DBAG
geometry with the right gable on it**, which the game can render. This stage
takes a roofline profile from any source (scan, photo method or consensus) and
produces a derived runtime copy of the 3DBAG building. It is independent of the
photo evaluation: **it starts now on scan profiles**, and the photo methods feed
the same code once R8 passes.

### What exists and what doesn't
- 3DBAG LoD2.2 per building is cached offline as CityJSONFeatures with
  `WallSurface` / `RoofSurface` / `GroundSurface` semantics
  (`.cache/pointcloud/3dbag-<bbox>.json`, T3).
- It has no gables: `wallTop == roofTop` on 0 of 895 canal-belt buildings.
- `facadeMeshCompiler.ts` already turns a scan silhouette into a closed
  `gable` polygon above `wallTop` (with `minimumGableRise` 0.3 m). It doesn't
  attach it to anything.
- The per-case gable work (case-12 halsgevel, case-21 klokgevel, case-27
  roof coverage in `scripts/review/roof-coverage-corrections.*` and
  `apply-source-silhouette.ts`) draws a **hand-traced pixel silhouette onto a
  synthetic study model and deliberately never touches 3DBAG**. It doesn't
  scale, and it is the thing this stage replaces.
- The game keeps source roofs only through `selectCompatibleSourceRoof`
  (`src/canalRecall/cityAppearanceRoofs.ts`) and otherwise renders one wall
  height per building. `wallTop.ts` gives the real eave per wall.

### Principles
1. **Additive only in v1.** Never cut, move or re-triangulate a 3DBAG surface.
   A gable is a new surface added in front of or on top of the source. If a
   profile says 3DBAG is *too high* at the facade, record a conflict and abstain.
   Cutting the roof is a v2 decision that needs its own evidence.
2. **Source geometry stays untouched.** The output is a derived copy plus an
   additive patch with provenance (profile source and hash, 3DBAG ID and
   version, gable class, confidence). It is revocable through the existing
   revocation registry pattern, and revocation never recreates a gable from a
   prior.
3. **Snap to Amsterdam gable types, not raw polylines.** A clean low-poly
   klokgevel of the right width and height beats a noisy trace at game distance.
4. **Scan beats photo** when both exist for a wall. The photo is for walls the
   scan doesn't cover.

### Relation classes (per contiguous span along the facade)
Compare the profile `P(along)` with the 3DBAG section `S(along)`: the highest
3DBAG surface point within 1 m behind the facade plane in each column.

| Relation | Meaning | Action |
| --- | --- | --- |
| `agree` (\|P − S\| ≤ 0.30 m) | 3DBAG already has this edge, e.g. a tuitgevel where the gable follows the roof pitch | No change |
| `rises` (P above S by > 0.30 m) | False-front gable: trap-, hals-, klok-, or a raised lijstgevel parapet | Add a **gable screen**: front face coplanar with the 3DBAG wall, 0.30 m thick, top following the fitted gable, bottom closed onto S |
| `below` (P under S by > 0.30 m) | 3DBAG roof at the facade is higher than measured: a setback, generalisation or a bad profile | **Abstain** and record the conflict. No change in v1 |
| `unknown` | Profile is `null` there | No change |

### G1: Section and reconcile core (Sonnet; wave 1)
Depends on: the cached 3DBAG features; R1's gold schema (it uses scan
profiles, so no photo tasks are needed).
1. `src/canalRecall/facade/roofReconcile.ts`. Input: a 3DBAG LoD2.2
   `BuildingPart` (with the CityJSON transform applied, RD/NAP), an elevation
   plane (`start`, `end`), a profile at 0.10 m in the §3 frame, and a fitted
   gable (G2). Output: `{ relationSpans, patch: Surface[] | null, conflicts, provenance }`.
2. Compute `S(along)` from the LoD2.2 surfaces. Classify the spans and build
   the gable screen for `rises` spans.
3. Validity checks, each with a test: the screen's front face is coplanar
   with the 3DBAG wall within 1 cm; its along-range stays inside the elevation
   (never over a neighbour's plot); the peak is ≤ 6 m above the 3DBAG ridge;
   it's closed (no gaps where it meets S); ≤ 80 triangles per gable; no
   degenerate triangles.
4. Tests on synthetic buildings: a flat-topped box plus a step-gable profile →
   a screen with the right steps; a pitched box whose section already matches
   → `agree`, no patch; a profile below the roof → conflict, no patch.
Done when: tests pass and it runs over every R1 gold elevation using **scan**
profiles, reporting counts per relation class. Overlay: an elevation view of
3DBAG plus the patch for each gold elevation.

### G2: Gable-type fitting (Sonnet; wave 1)
Depends on: nothing.
1. `src/canalRecall/facade/gableFit.ts`. Given a profile and the
   `classifyGable` result (`gable.ts`), fit a parametric template per
   type: `lijstgevel` (flat cornice, optional parapet), `puntgevel` / `tuitgevel`
   (triangle, apex and eave), `trapgevel` (staircase: step count, rise, run),
   `halsgevel` (neck width and height, shoulders), `klokgevel` (bell: neck plus
   curved shoulders as ≤ 6 segments). Fit by least squares on the non-null
   columns. Fall back to a Douglas–Peucker polyline (0.15 m) when the fit
   error beats no template by less than 30 %, or the type is `unknown`.
2. Enforce left/right symmetry for types that are symmetric in practice (all
   except `unknown`), but only when one side is occluded (`null`). A measured
   asymmetry wins.
3. Tests: each template recovers its own parameters from noisy samples
   (σ 0.1 m); a half-occluded klokgevel is completed by mirroring.
Done when: the table of fit errors per gold elevation is in the report.

### G3: Game render path (integrator; wave 2)
Depends on: G1.
Wire the patch into the city renderer (`cityAppearanceThree.ts`) and the
source-to-owner preview, behind a flag that's off by default. The patch
surfaces go through the same material path as walls. This touches shared
bundles, so the integrator owns it.
Done when: the Museumkwartier gold buildings render with their scan-derived
gables at gameplay camera distance, captured on desktop and phone, next to the
panorama view of the same facade.

### G4: Reconciliation evaluation (integrator + owner; wave 3)
1. **Geometric fidelity:** section the patched mesh at the facade plane and
   compare it to the input profile. Median error ≤ 0.15 m on scan inputs
   (this tests G1 and G2, not the photos).
2. **Recognition (the one that matters):** for each gold elevation, show the owner
   the panorama view next to the in-game render. Question: *is this the right
   gable?* Yes/no per building. Adopt the reconciler for scan inputs if ≥ 80 %
   are yes. The owner answers; an agent doesn't.
3. **Photo chain (after R8 passes):** run the adopted photo method → G2 → G1
   and compare the patch with the scan-derived patch for the same elevation.
   Same thresholds as §1 on the patched section.

### Execution plan (supersedes the §6 table)

| Wave | Canal-belt strips (§0) | Reconciliation (§7) | Validation (Oud-Zuid scan) |
| --- | --- | --- | --- |
| 1 | A0 re-cut with headroom (DeepSeek) · A1 segmentation (DeepSeek) · A3 3DBAG (DeepSeek) | G2 gable fitting (Sonnet) | R1 gold (Sonnet) · R5 scorer code (DeepSeek) |
| gate | Integrator reviews the A0 contact sheet and clipped share | | Integrator reviews R1 overlays and marks `spotCheck` |
| 2 | A2 snapping and profiles (Sonnet) | G1 reconcile core (Sonnet) | A5 Oud-Zuid crops with headroom → A1 → A2 |
| 3 | A4: G1 on the canal-belt walls | G3 render (integrator) | R5 run for S0, S1, S2 |
| 4 | G4 owner review | | R8 verdict; S3/S4 only if S1 fails |

R2, R3, R4 and R6 are replaced by A0, A1 and A2 (the strips are already
rectified, so the separate perspective-view and projection steps aren't needed).

The reconciliation lane can succeed even if every photo method fails: then the
result is "gables from the scan where we have scans", which is still the first
3DBAG-compatible gable in the game.

## 8. Out of scope

- Windows, doors and openings (see FACADE_MODEL_EVALUATION_PLAN.md).
- Training or fine-tuning. Revisit only if a method nearly passes and the
  failure is a specific Amsterdam class.
- Canal-belt runs before R8 passes.
- Cutting or re-triangulating 3DBAG roofs (the `below` class). That is v2, after G4.
