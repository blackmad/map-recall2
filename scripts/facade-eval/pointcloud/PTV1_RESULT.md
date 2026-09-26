# Lane E — PTv1 on a rented GPU: result and blocker

Status: run 2026-09-22. Branch `feat/facade-gpu-ptv1`. The user authorised the
§9 "E · PTv1 on GPU" deferral. This is the report; the pipeline is committed so a
future run is one command, but **the model did not work on Amsterdam**.

## TL;DR

- **pointops built with no source patch** on torch 2.9.1+cu128 / CUDA 12.8 /
  RTX A4000 first try, once `.DS_Store` `._*` files were stripped from the
  streamed code tree and `pip install --no-build-isolation --break-system-packages`
  was used.
- **PTv1 does not segment Amsterdam façades.** Across both tiles it predicted
  `terrain` for ~100% of façade points and **zero** `wall` / `window` / `door`
  points. 0 of the 60 gold walls got a usable opening prediction, so 0 boxes.
- This matches the checkpoint's own metadata: `best_iou` 0.15 on the source
  cross-domain validation split (train mIoU 0.66). The collapse is the model's
  known domain gap and a source-domain bias toward terrain, not an input bug —
  verified with synthetic walls, all 15 classes, and both the lofg3 and lofg2
  checkpoints.
- Spend: **$0.041** of the $2 cap. Pod deleted, confirmed gone.

## Verdict

Do not adopt PTv1 (lane E) for Amsterdam openings. It joins lane D in the
"answers a question the geometric classifier already answers" bucket, and the
geometric classifier is deterministic, local and free. Revisit only if a
fine-tuned Amsterdam checkpoint is trained — the pipeline here is the harness
for that.

## Commands run

Local prep (no GPU):

```bash
npm install
mkdir -p .cache/pointcloud
cp <rebuild-worktree>/.cache/pointcloud/filtered_2397_9705.laz .cache/pointcloud/
cp <rebuild-worktree>/.cache/pointcloud/filtered_2386_9702.laz .cache/pointcloud/
shasum -a 256 .cache/pointcloud/*.laz   # match manifest.txt sha256

python3 -m venv .cache/ptv1-venv
.cache/ptv1-venv/bin/pip install gdown numpy

# code folder (Drive folder id 1HFn20b8olrwabYFvEl6-W9NYIYrPjozK); gdown --folder
# hangs on this machine, so the file list + ids came from gdown --json and each
# file was fetched with gdown <id> -O <path>.
# weights: gdown <id> fails on the >100 MB virus-scan wall; fetched with a small
# requests session that posts the confirm form. See FACADE_MODEL_EVAL.md notes.

npx tsx scripts/facade-eval/pointcloud/convert-tile-npy.ts \
  .cache/pointcloud/filtered_2397_9705.laz \
  .cache/underonefacade/tiles/filtered_2397_9705.npy
npx tsx scripts/facade-eval/pointcloud/convert-tile-npy.ts \
  .cache/pointcloud/filtered_2386_9702.laz \
  .cache/underonefacade/tiles/filtered_2386_9702.npy
```

Pod (RTX A4000, community, $0.17/hr; A5000/A4500 were out of stock, A4500 came
back later at $0.19/hr):

```bash
runpodctl pod create --name underonefacade --gpu-id "NVIDIA RTX A4000" \
  --cloud-type COMMUNITY --public-ip \
  --image runpod/pytorch:1.0.3-cu1281-torch291-ubuntu2404 \
  --container-disk-in-gb 30 --volume-in-gb 20 --ports "22/tcp" --wait
```

Build pointops (first try, no patches):

```bash
export PATH=/usr/local/cuda/bin:$PATH
pip install --break-system-packages -q numpy PyYAML ninja setuptools wheel
cd /workspace/underonefacade/models/pointops_lib
cat > functions/__init__.py <<'PY'
from .query import knn_query, ball_query, random_ball_query
from .sampling import farthest_point_sampling
from .grouping import grouping, grouping2
from .interpolation import interpolation
from .subtraction import subtraction
from .aggregation import aggregation
from .attention import attention_relation_step, attention_fusion_step
from .utils import (
    query_and_group, knn_query_and_group, ball_query_and_group,
    offset2batch, batch2offset,
)
PY
pip install --break-system-packages --no-build-isolation -e .
```

Inference and fetch:

```bash
python infer_ptv1.py \
  --code-root /workspace/underonefacade \
  --weights /workspace/underonefacade/PT_lofg3_xyz.pth \
  --npy /workspace/tiles/filtered_2397_9705.npy \
  --npy /workspace/tiles/filtered_2386_9702.npy \
  --out-dir /workspace/preds --batch-windows 16
# then scp the two .pred.npy files back
runpodctl pod delete <id>
```

Local boxes:

```bash
npx tsx scripts/facade-eval/pointcloud/build-boxes.ts
```

## pointops build: what broke and what fixed it

No CUDA source edits were needed (`AT_CHECK`, `THC`, `.type<int>()` are not in
this release; it already uses `TORCH_CHECK`, `torch/serialize/tensor.h`,
`c10::cuda`). Three environment issues, all fixed on the pod:

1. `pip install -e .` failed with PEP 668 `externally-managed-environment`.
   Fix: `--break-system-packages`.
2. With build isolation, `setup.py` could not `import torch`. Fix:
   `--no-build-isolation` (with `ninja` installed).
3. macOS `._*` AppleDouble files were streamed in, and `setup.py` globs every
   `.cpp`/`.cu`, so it tried to compile `._pointops_api.cpp` and
   `._attention_cuda.cpp` as C++. This produced `stray '\5' in program` and
   `'Mac' does not name a type`. Fix: `find /workspace/underonefacade -name '._*' -delete`
   before building. Any future transfer from macOS must use `COPYFILE_DISABLE=1`
   or strip these.

`pointops` imported and the model forward ran on CUDA with 0 missing / 0
unexpected keys.

## Why the output is all `terrain`

`infer_ptv1.py` slides 1.5 m XY windows with a 1.0 m Z stride and repeats
`datasets/facade_dataset.py`'s `PointOffsetDataset` normalisation exactly
(`coords -= mean; coords /= max radius`, `feature_columns=[0,1,2]` so `feat =
coords`). It offset-batches, softmaxes and votes per point.

Findings that rule out an input bug:

- A synthetic 3x3 m vertical wall with a 0.3 m recessed opening also returns
  `terrain`/`other`; the model never labels a flat façade `wall`.
- Both `PT_lofg3_xyz.pth` (15-class) and `PT_lofg2_xyz.pth` (5-class) fail the
  same way, with 0 missing keys.
- A random sweep of 159 real 1.5 m windows over the Museumkwartier façade:
  2 windows contained any façade class at all, and none contained `wall`,
  `window` or `door`.
- On the checkpoint, `best_iou = 0.1519`, `val_miou` peaks at 0.158, while
  `train_miou` reaches 0.66. The released global weights are weak off their
  source domain.

The model is simply not usable zero-shot on this MLS data. That is the H0 the
plan's §9 warned about.

## Throughput

- RTX A4000, PTv1 lofg3 xyz, 8192 pts/window: ~400k–420k model points/s,
  ~56–64 windows/s end to end including gather, normalise and vote.
- Museumkwartier (10.85 M pts, 3947 windows): 70 s. Willemspark (7.17 M pts,
  4081 windows): 68 s. Total inference ~2.3 min for both tiles.

## Artifacts

- `scripts/facade-eval/pointcloud/infer_ptv1.py` — GPU inference (the harness).
- `scripts/facade-eval/pointcloud/convert-tile-npy.ts` — LAZ → `(N,8)` `.npy`.
- `scripts/facade-eval/pointcloud/build-boxes.ts` — predictions → wall-frame boxes.
- `review-data/facade-model-eval/ptv1-R0.json` — the emitted lane JSON (60 walls,
  0 boxes), same contract as the photo lanes.

The `.cache/underonefacade/` code, weights and predictions are gitignored (weights
are third-party and large; predictions are 18 MB). Re-download with the ids in
the lane brief.

## Reproduction cost

One A4000 pod for ~26 min wall-clock (create, build, infer, transfer, delete):
**$0.041 spent**, balance $10 → $9.933 at ~$0.17/hr for the A4000 portion. Pod
`dwkod5e2zvvhos` deleted; `runpodctl pod list` empty; `runpodctl user`
`currentSpendPerHr` 0.
