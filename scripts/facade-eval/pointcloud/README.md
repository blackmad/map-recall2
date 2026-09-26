# Lane D — DGCNN façade segmentation (point cloud)

Runs the **UnderOneFacade** DGCNN semantic-segmentation model (ECCV'26) on the
two Amsterdam municipal MLS tiles and emits per-wall opening boxes in the shared
wall-metric frame, for scoring against the frozen measured gold set.

This is the point-cloud lane of
[`FACADE_MODEL_EVALUATION_PLAN.md`](../../../FACADE_MODEL_EVALUATION_PLAN.md) §9
("D · DGCNN/PointNet++"), now run locally on CPU / Apple MPS with no CUDA,
spconv or pointops build. It is task 9's "revisit when the host returns"
experiment, done against the same gold set as lanes A and B.

## Files

| File | Role |
| --- | --- |
| `export-tile-npy.ts` | LAZ → `(N, 8)` float32 `.npy` `[X,Y,Z,R,G,B,Intensity,Label]` |
| `infer_dgcnn.py` | sliding-block inference, per-point vote → label/confidence `.npy` |
| `build-boxes.ts` | labels → wall-frame opening boxes via the measured pipeline's raster/compiler |
| `README.md` | this file |

## Model provenance (pinned)

The UnderOneFacade GitHub repo has no code; the code and weights are Google
Drive links from the paper.

| Item | Value |
| --- | --- |
| Code folder | `https://drive.google.com/drive/folders/1HFn20b8olrwabYFvEl6-W9NYIYrPjozK` |
| Weights, LoFG3 | `DGCNN_lofg3_xyz.pth`, file id `1_N_EAUNzOjpOEIJZ3zOSWq7JTPmRzNtA`, sha256 `6ea87322414e09303905251ae4f92c7c59df0cdd17d90c80b9103dd8d7e21028`, 11 858 049 bytes |
| Weights, LoFG2 | `DGCNN_lofg2_xyz.pth`, file id `1Ads9GYtGF_vCYPu96wqE3fap-p45kyue`, sha256 `d0e2bb08332012cac3a62d72b25879c412e3dd9158bc6397f7990fe0b917ca6f`, 11 827 137 bytes |
| Checkpoint format | `{epoch, state_dict, opt, lr_scheduler, best_val_f1, metrics}`; keys prefixed `module.net.` |
| LoFG3 classes | wall, window, door, balcony, molding, deco+, column, arch, stairs, ground surface, terrain, roof, blinds, interior, other (15) |
| Device | Apple MPS (arm64), torch 2.14.0 |

`gdown --folder` fetches the code, but `gdown <file-id>` fails for the weights
with "Cannot retrieve the public link". The direct endpoint works:

```bash
curl -L "https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t" -o <name>.pth
```

**The code bundle ships without `models/__init__.py`**, so
`from models import get_engine` raises. `infer_dgcnn.py` writes the minimal
registry (a name → engine-class dict plus the `@register_engine` decorator) into
`.cache/underonefacade/code/models/__init__.py` on first run. Hashing a
checkpoint's `conv1.0.weight` `(64, 6, 1, 1)` gives `in_channels = 3`; stripping
both the `module.` and `net.` prefixes loads every weight (`strict=True`-clean).

## Environment

An isolated venv lives at `.cache/facade-eval/venv-dgcnn/` (Python 3.11.16,
macOS arm64, MPS). Recreate with:

```bash
uv venv .cache/facade-eval/venv-dgcnn --python 3.11
uv pip install --python .cache/facade-eval/venv-dgcnn/bin/python -r scripts/facade-eval/requirements-dgcnn.txt
```

Pinned: `torch==2.14.0`, `numpy==2.4.6`, `PyYAML==6.0.3`, `tqdm==4.70.1`,
`gdown==6.4.0` (fetch only). DGCNN needs no spconv / torch-geometric / pointops /
ocnn.

## Pipeline

```bash
# 2. LAZ -> (N, 8) float32 npy (reuses scripts/pointcloud/load-laz-tile.ts)
npx tsx scripts/facade-eval/pointcloud/export-tile-npy.ts \
  --tile=.cache/pointcloud/filtered_2397_9705.laz

# 3. sliding-block inference (block 1.5 m, stride 1.0 m, 4096 pts/block)
.cache/facade-eval/venv-dgcnn/bin/python scripts/facade-eval/pointcloud/infer_dgcnn.py \
  --npy .cache/facade-eval/dgcnn/tiles/filtered_2397_9705.npy \
  --weights .cache/underonefacade/weights/DGCNN_lofg3_xyz.pth --lofg lofg3 \
  --out .cache/facade-eval/dgcnn/preds/filtered_2397_9705.lofg3.npy \
  --block-size 1.5 --stride 1.0 --batch-size 16 --device mps

# 4. labels -> opening boxes in the wall frame (both tiles -> one JSON)
npx tsx scripts/facade-eval/pointcloud/build-boxes.ts --lofg=lofg3 \
  --tiles="museumkwartier:.cache/pointcloud/filtered_2397_9705.laz:.cache/facade-eval/dgcnn/preds/filtered_2397_9705.lofg3.npy,willemspark:.cache/pointcloud/filtered_2386_9702.laz:.cache/facade-eval/dgcnn/preds/filtered_2386_9702.lofg3.npy" \
  --out=.cache/facade-eval/dgcnn-oudzuid-lofg3.json
```

Inference replicates `datasets.facade_dataset.BlockDataset` for xyz-only
features exactly: keep points inside `ctr ± block_size/2` in x/y, sample
`num_point` (with replacement if fewer), then `xyz -= mean; xyz /= (max_radius +
1e-6)`. The normalised xyz **is** the feature vector. Per-block softmax is added
back onto the source points (per-point vote); the per-point label is the argmax
of the accumulated mean probability.

## Box construction

`build-boxes.ts` reuses the measured pipeline rather than re-deriving geometry:

* the tile is decoded by `scripts/pointcloud/load-laz-tile.ts`;
* the wall frame and raster come from
  `wallMetricFrame` / `rasteriseWall` / `projectToWall` / `wallSilhouette`
  (`src/canalRecall/facade/pointCloudGeometry.ts`);
* the clustering/refinement/regularisation is
  `compileFacade` (`src/canalRecall/facade/facadeMeshCompiler.ts`).

The only swap versus the measured path is the opening **mask**: instead of the
depth heuristic (`meanDepth <= −0.25 m`), only model `window`/`door` points
(LoFG3) or `opening` points (LoFG2) are fed to `rasteriseWall`, and
`compileFacade` is called with `minimumRecessDepth` far negative so every solid
cell is a model opening. Boxes are then converted from the raster's
centroid-relative frame to the shared crop frame (`along` = metres from
`plane.start`, `up` = metres above `plane.baseZ`), matching
`scripts/facade-eval/build-gold-set.ts`. `regulariseOpenings` can snap several
raw clusters onto one grid box, so duplicates are removed before scoring.

### Output contract

`.cache/facade-eval/dgcnn-oudzuid-lofg3.json` (and `…-lofg2.json`):

```json
{ "schemaVersion": 1, "lane": "dgcnn",
  "model": "UnderOneFacade/DGCNN (lofg3, xyz; …)",
  "setting": "pointcloud",
  "records": [ { "buildingId": "…", "elevationId": "…:lod22:wall:5",
    "surfaceId": "…:lod22:wall:5", "wallWidthM": 6.24, "wallHeightM": 14.58,
    "cropFile": "public/data/facade-model-eval/v1/crops/….jpg",
    "cropWidthPx": 281, "cropHeightPx": 656, "pixelsPerMetre": 45.033,
    "tiles": 1, "boxes": [ { "kind": "window", "score": 0.9,
      "along": 0.0, "up": 2.1, "widthM": 0.95, "heightM": 2.33 } ] } ] }
```

`cropFile`/crop size are carried from the gold record because this lane reads no
image; `tiles` is 1 (one point-cloud pass). The scorer keys records by
`elevationId ?? surfaceId`, both set to the gold `surfaceId`.

## Measured results (this machine, honest)

Ran on both demo tiles, block 1.5 m / stride 1.0 m / 4096 points, MPS.

| Tile | Points | Windows run | Mean s/block | Wall clock (projected full tile) | Opening points (LoFG3) | Opening points (LoFG2) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Willemspark `filtered_2386_9702` | 7 165 726 | 2 349 / 2 500 | 0.0437 | 105.1 s | 3 | 0 |
| Museumkwartier `filtered_2397_9705` | 10 854 907 | 2 279 / 2 500 | 0.0438 | 103.2 s | 0 | 0 |

CPU is ~0.160 s/block (≈6.9 min/tile). A denser check (stride 0.5 m, 9 035
windows, 404 s) confirms sampling coverage is not the limit: opening points rose
only to 42 / 7.17 M and still none on a gold wall.

Predicted label distribution over **all** tile points (LoFG3): ~34–54 % wall,
45–56 % roof, 0.1–8 % interior, and essentially nothing else. Restricted to the
actual gold-wall slab points (AABB of the crop plane, ±0.4 m; every one of the
60 walls has a dense slab: 1 735 779 and 979 027 points):

| Class | Museumkwartier slab | Willemspark slab |
| --- | ---: | ---: |
| wall | 1 326 114 (76.4 %) | 707 058 (72.2 %) |
| roof | 399 116 (23.0 %) | 183 826 (18.8 %) |
| interior | 9 478 (0.5 %) | 82 745 (8.5 %) |
| **window + door** | **0 (0.0 %)** | **0 (0.0 %)** |

Scored against the 60-wall measured gold set (70 measured openings):

```
lane dgcnn-lofg3 (pointcloud) vs measured gold   · IoU >= 0.5
measured openings   70 across 20/60 walls
predicted boxes     0 across 0/60 walls
matched 0   fp 0   fn 70
precision n/a (0/0)   recall 0.0% (0/70)   median centre error n/a
adoption rule: recall FAIL · precision FAIL · centre FAIL => does NOT clear
```

**Conclusion: the global UnderOneFacade DGCNN weights do not transfer to
Amsterdam MLS.** The model labels façades as wall/roof and finds no windows or
doors, so it yields zero opening boxes and 0 % recall. This is a domain-gap
result from a UK+Germany+Singapore-trained model, measured on the same 60 gold
walls as lanes A and B — not a bug in the adapter (a control run that treats a
populated class as the mask produces 283 boxes across all 60 walls, so the frame
and compiler path is correct).

## Blockers / notes for the integrator

* Predictions are written to `.cache/facade-eval/dgcnn-oudzuid-lofg3.json` and
  `…-lofg2.json` (gitignored), matching the lane A/B `.cache/facade-eval/…`
  convention. `publish-eval-demo.ts` and `index.json` are owned by the
  integrating agent; this lane did not edit them.
* The two `.pth` files are fetched from Google Drive by direct URL because
  `gdown <file-id>` rejects them; the code folder fetches fine with `gdown
  --folder`.
* Absolute RD/NAP coordinates are used for block sampling (the model normalises
  per block), so Float32 quantisation is irrelevant here.
* Predictions are saved alongside a `<out>.provenance.json` (weights sha256,
  settings, timings, class counts).
