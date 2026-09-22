# Lane B — `run_windet.py`

Adapter for the MIT-licensed façade window detector
[`lck1201/win_det_heatmaps`](https://github.com/lck1201/win_det_heatmaps)
(Chuan-Kang Li et al., *Window Detection in Facades Using Heatmap Fusion*, JCST
2020). It runs the published ResNet18 model on rectified façade crops and emits
window boxes in **wall metres** in the shared lane JSON contract.

This is task 7 of [`FACADE_MODEL_EVALUATION_PLAN.md`](../../FACADE_MODEL_EVALUATION_PLAN.md).

## Model provenance (pinned)

| Item | Value |
| --- | --- |
| Repo | https://github.com/lck1201/win_det_heatmaps |
| Repo commit | `c41cf77707f1f2aae7cc50a640982f5c23fa5db9` |
| Model id in output | `lck1201/win_det_heatmaps@c41cf77707f1f2aae7cc50a640982f5c23fa5db9` |
| Weights page | https://drive.google.com/file/d/14RHcjred7cWu7ojkMASAA_JA2sm-0DNG/view |
| Weights direct | `https://drive.usercontent.google.com/download?id=14RHcjred7cWu7ojkMASAA_JA2sm-0DNG&export=download&confirm=t` |
| Repo path in that Drive folder | `model/resnet18_model_latest.pth.tar` |
| **Weights sha256** | `58c450420bad960894ce51db4a06e625713b9c03862ee84d4ad406e8014423ba` |
| Weights size | 234,958,173 bytes |
| Licence | MIT (repo `LICENSE`); weights offered by the authors in the same folder |

The upstream README links both dataset and models to one Google Drive folder
(`1TfeIcQ8KlEvP1-ewGcTaj3SqU_IpoLUv`); `--fetch` downloads only the ResNet18
checkpoint, which the README table reports as the strongest of the three
(P@IoU0.5 88.4, R@IoU0.5 91.2). If the sha256 does not match, the adapter
**stops** — no substitute model is ever used.

## Environment

An isolated venv lives at `.cache/facade-eval/venv-windet/` (Python 3.11.16,
macOS arm64, Apple MPS). Recreate and install with:

```bash
uv venv .cache/facade-eval/venv-windet --python 3.11
uv pip install --python .cache/facade-eval/venv-windet/bin/python -r scripts/facade-eval/requirements-windet.txt
```

Pinned versions used for the measurements below: `torch==2.14.0`,
`torchvision==0.29.0`, `numpy==2.4.6`, `opencv-python==5.0.0.93`,
`scipy==1.17.1`, `munkres==1.1.4`, `easydict==1.13`, `matplotlib==3.11.2`,
`PyYAML==6.0.3`, `pillow==12.3.0`.

The upstream code targets older numpy/torch; `run_windet.py` applies two
compatibility shims at import time (no source edits to the third-party repo):

* `np.int` / `np.float` / `np.bool` are restored if missing.
* `tag_group.get_coords_from_heatmaps_with_NMS` is wrapped so that a corner
  heatmap with no peak above 0.1 yields an empty `(0, 4)` array instead of a
  1-D array. Without this, blank/sky regions crash the upstream parser.

## Fetch and verify

```bash
.cache/facade-eval/venv-windet/bin/python scripts/facade-eval/run_windet.py --fetch
.cache/facade-eval/venv-windet/bin/python scripts/facade-eval/run_windet.py --check-weights
```

`--fetch` clones the repo at the pinned commit into
`.cache/facade-eval/win_det_heatmaps/` and downloads + sha256-verifies the
weights into `.cache/facade-eval/weights/`.

## Run

```bash
MANIFEST=.cache/city-appearance/areas/apollobuurt-v1/panorama-audit/70ddd2d4a19b94d103595e529ef42d4c2ae526be895c09a4e567c59295ee580b/evidence/manifest.json
.cache/facade-eval/venv-windet/bin/python scripts/facade-eval/run_windet.py \
  --manifest "$MANIFEST" --setting R0 --limit 100 \
  --out .cache/facade-eval/windet-R0-apollobuurt-100.json
```

Useful flags: `--setting R0|R1`, `--selection selection.json`, `--limit N`,
`--device auto|cpu|mps`, `--no-flip`, `--no-center`, `--window-t`, `--center-t`,
`--tile-px` (default 768), `--tile-overlap` (default 0.15), `--nms-iou` (0.5),
`--force`.

**Selection** accepts the area `selection.json` shape
(`{"elevationIds": [...]}`), a plain list of elevation ids, or a
`{"records": [...]}` list whose entries may carry `elevationId` and an optional
`cropFile` override. Output order follows manifest order.

**Resumable / deterministic.** Results are appended to `<out>.jsonl`, keyed by
`(setting, buildingId, elevationId)`. A re-run reuses the cache and rewrites
`<out>` from it; `--force` recomputes. Per-crop failures are written to
`<out>.errors.jsonl` and never abort the run. Two `--force` runs produce
byte-identical JSON.

## Output contract

```json
{ "schemaVersion": 1, "lane": "windet",
  "model": "lck1201/win_det_heatmaps@c41cf77707f1f2aae7cc50a640982f5c23fa5db9",
  "setting": "R0",
  "records": [ { "buildingId": "...", "elevationId": "...", "surfaceId": "...",
    "wallWidthM": 14.2493, "wallHeightM": 15.612,
    "cropFile": ".../0363100012154954_e_1v5ffeu-full.jpg",
    "cropWidthPx": 641, "cropHeightPx": 703, "pixelsPerMetre": 44.985, "tiles": 1,
    "boxes": [ { "kind": "window", "score": 0.9161, "along": 4.4766,
                 "up": 4.9601, "widthM": 0.6511, "heightM": 1.301 } ] } ] }
```

Conventions fixed here so lane A and the scorer agree:

* Crop x runs from `plane.start` to `plane.end`; crop y runs downward from
  `plane.topZ` to `plane.baseZ` (`src/canalRecall/facade/rectify.ts`).
* `along` = metres from `plane.start`; `up` = metres above `plane.baseZ`. Both
  are the **lower-left** corner of the axis-aligned box; `widthM`/`heightM` are
  positive. (`up` is a relative offset, not an absolute NAP height.)
* `wallWidthM` is the metric width of the **crop** = the plane's horizontal
  length, so `wallWidthM == cropWidthPx / pixelsPerMetre`. The BAG `wallWidthM`
  in the evidence manifest is usually a little shorter because the crop carries
  margin. `wallHeightM = plane.topZ - plane.baseZ`.
* `surfaceId` is the manifest record `id` (`<buildingId>_e_<hash>`).
* `cropFile` is the absolute path of the image actually read.

A sidecar `<out>.provenance.json` records the weights URL + sha256, repo sha,
device, thresholds, tile settings, and measured seconds/crop.

## R0 vs R1

* **R0** — one forward pass on the whole cached strip (45 px/m).
* **R1** — tile the crop into 768×768 px squares with 15 % overlap, detect per
  tile, map each detection to wall metres, merge with greedy NMS at IoU 0.5.

The model's native patch is 384 px, so it always resizes its input. R1 only
raises the effective resolution when the crop is larger than 768 px (or when
lane C later supplies a higher-px/m re-render). On the current 45 px/m cached
strips, most crops are smaller than 768 px and R1 == R0. **True R1 awaits lane
C's `prepare-crops.ts`**; once it lands, pass its crops via `--selection`
`cropFile` overrides (or point `--manifest` at its frame data) and the tiling
path is already in place.

## Measured performance (this machine)

Apple M-series, MPS, flip test on, center filter on, `window-t`/`center-t` 0.5,
patch 384. Wall-clock includes Python + torch startup (~2 s).

| Run | Crops | Boxes | Empty | mean s/crop | median s/crop | wall clock |
| --- | --- | --- | --- | --- | --- | --- |
| R0, apollobuurt first 100 | 100 | 579 | 19 | 0.0835 | 0.0754 | 13.2 s |
| R1, apollobuurt first 100 | 100 | 669 | — | 0.1335 | 0.1247 | 17.0 s |

Errors: 0. The 8-crop smoke test (R0) produced 8 records, mean 0.0698 s/crop,
median 0.0498 s/crop.

## Blockers / notes for the integrator

* None blocking. Weights are obtainable and sha256-pinned.
* Cached strips live in `.cache/city-appearance/`, which is gitignored and
  per-worktree; this lane read the copy in the `amsterdam-facade-rebuild`
  worktree via a `.cache/city-appearance` symlink.
* The `up` field is relative to `plane.baseZ`. If lane A emits absolute NAP
  heights instead, the scorer must reconcile before comparing.
