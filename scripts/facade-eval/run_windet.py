#!/usr/bin/env python3
"""Lane B facade opening adapter: lck1201/win_det_heatmaps.

Runs the MIT-licensed heatmap-fusion window detector on rectified facade crops
and emits window boxes in wall metres, in the shared lane JSON contract:

    { "schemaVersion": 1, "lane": "windet",
      "model": "lck1201/win_det_heatmaps@<sha>", "setting": "R0"|"R1",
      "records": [ { "buildingId", "elevationId", "surfaceId",
                     "wallWidthM", "wallHeightM", "cropFile",
                     "cropWidthPx", "cropHeightPx", "pixelsPerMetre", "tiles",
                     "boxes": [ { "kind": "window", "score",
                                  "along", "up", "widthM", "heightM" } ] } ] }

Conventions, fixed here so lane A and the scorer agree:

* The crop's x axis runs from ``plane.start`` to ``plane.end``; x = 0 is
  ``plane.start``. The y axis runs downward from ``plane.topZ`` to
  ``plane.baseZ`` (see src/canalRecall/facade/rectify.ts).
* ``along`` is metres from ``plane.start``; ``up`` is metres above
  ``plane.baseZ``. Both are the lower-left corner of the axis-aligned box.
* ``wallWidthM`` is the metric width of the *crop* (the plane's length), so
  ``wallWidthM == cropWidthPx / pixelsPerMetre`` exactly. The BAG wall length in
  the evidence manifest is usually a little shorter because the crop carries
  margin. ``wallHeightM`` is ``plane.topZ - plane.baseZ``.

R0 runs the detector once on the whole cached strip. R1 tiles the crop into
``--tile-px`` squares with ``--tile-overlap`` and merges detections with NMS at
``--nms-iou`` in wall metres.

Provenance (also written to ``<out>.provenance.json``):

    repo:    https://github.com/lck1201/win_det_heatmaps @ c41cf77707f1f2aae7cc50a640982f5c23fa5db9
    weights: https://drive.google.com/file/d/14RHcjred7cWu7ojkMASAA_JA2sm-0DNG/view
             (repo path model/resnet18_model_latest.pth.tar, ResNet18 + Head)
    sha256:  58c450420bad960894ce51db4a06e625713b9c03862ee84d4ad406e8014423ba

Use ``--fetch`` to clone the repo at the pinned commit and download + verify the
weights, then run. No other model is ever substituted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import traceback
import urllib.request
from typing import Any, Iterable

REPO_URL = "https://github.com/lck1201/win_det_heatmaps"
REPO_SHA = "c41cf77707f1f2aae7cc50a640982f5c23fa5db9"
WEIGHTS_FILE_ID = "14RHcjred7cWu7ojkMASAA_JA2sm-0DNG"
WEIGHTS_URL = "https://drive.google.com/file/d/%s/view" % WEIGHTS_FILE_ID
WEIGHTS_DOWNLOAD_URL = (
    "https://drive.usercontent.google.com/download?id=%s&export=download&confirm=t"
    % WEIGHTS_FILE_ID
)
WEIGHTS_SHA256 = "58c450420bad960894ce51db4a06e625713b9c03862ee84d4ad406e8014423ba"
WEIGHTS_FILENAME = "resnet18_model_latest.pth.tar"

MODEL_ID = "lck1201/win_det_heatmaps@%s" % REPO_SHA

PATCH = 384
FEAT_STRIDE = 4
FLIP_PAIRS = ((0, 3), (1, 2))
MEAN = (0.485 * 255, 0.456 * 255, 0.406 * 255)
STD = (0.229 * 255, 0.224 * 255, 0.225 * 255)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url: str, dest: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    tmp = dest + ".part"
    with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as out:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    os.replace(tmp, dest)


def fetch_assets(repo_dir: str, weights_path: str) -> None:
    """Clone the pinned repo and download + verify the pinned weights."""
    if not os.path.isdir(os.path.join(repo_dir, ".git")):
        os.makedirs(repo_dir, exist_ok=True)
        subprocess.run(["git", "init", "-q", repo_dir], check=True)
        subprocess.run(
            ["git", "-C", repo_dir, "remote", "add", "origin", REPO_URL], check=True
        )
        subprocess.run(
            ["git", "-C", repo_dir, "fetch", "-q", "--depth", "1", "origin", REPO_SHA],
            check=True,
        )
        subprocess.run(
            ["git", "-C", repo_dir, "checkout", "-q", "--detach", "FETCH_HEAD"],
            check=True,
        )
    head = subprocess.run(
        ["git", "-C", repo_dir, "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if head != REPO_SHA:
        raise SystemExit("repo HEAD %s != pinned %s" % (head, REPO_SHA))

    if not os.path.exists(weights_path) or sha256_file(weights_path) != WEIGHTS_SHA256:
        os.makedirs(os.path.dirname(weights_path), exist_ok=True)
        print("downloading weights %s" % WEIGHTS_DOWNLOAD_URL)
        _download(WEIGHTS_DOWNLOAD_URL, weights_path)
    got = sha256_file(weights_path)
    if got != WEIGHTS_SHA256:
        raise SystemExit("weights sha256 mismatch: %s != %s" % (got, WEIGHTS_SHA256))
    print("weights ok %s" % got)


def import_model_modules(repo_dir: str):
    """Import the third-party model code with the shims it needs on numpy 2."""
    if repo_dir not in sys.path:
        sys.path.insert(0, repo_dir)

    import numpy as np

    for name, val in (("int", int), ("float", float), ("bool", bool)):
        if not hasattr(np, name):
            setattr(np, name, val)

    from common_pytorch.base_modules.architecture import PoseNet_2branch
    from common_pytorch.base_modules.deconv_head import DeconvHead
    from common_pytorch.base_modules.resnet import ResnetBackbone, resnet_spec
    from common.utility.image_processing_cv import (
        convert_cvimg_to_tensor,
        generate_patch_image_cv,
    )
    import common_pytorch.group.tag_group as tag_group

    # The upstream parser indexes an empty peak list as if it were 2-D, which
    # raises IndexError whenever a corner heatmap has no peak above 0.1 (blank
    # wall, sky, heavy blur). Reshape empty/ragged peak arrays to (N, 4) so the
    # grouping code treats them as "no corners" instead of crashing.
    _orig_coords = tag_group.get_coords_from_heatmaps_with_NMS

    def _safe_coords(heatmap, sigma=2, param_thre1=0.1):
        peaks = _orig_coords(heatmap, sigma=sigma, param_thre1=param_thre1)
        fixed = []
        for arr in peaks:
            arr = np.asarray(arr)
            if arr.ndim != 2:
                arr = np.zeros((0, 4)) if arr.size == 0 else arr.reshape(-1, 4)
            fixed.append(arr)
        return fixed

    tag_group.get_coords_from_heatmaps_with_NMS = _safe_coords

    return {
        "PoseNet_2branch": PoseNet_2branch,
        "DeconvHead": DeconvHead,
        "ResnetBackbone": ResnetBackbone,
        "resnet_spec": resnet_spec,
        "convert_cvimg_to_tensor": convert_cvimg_to_tensor,
        "generate_patch_image_cv": generate_patch_image_cv,
        "tag_group": tag_group,
    }


class WindetDetector:
    """ResNet18 heatmap-fusion detector, patch 384, optional flip test."""

    def __init__(
        self,
        repo_dir: str,
        weights_path: str,
        device: str = "auto",
        window_t: float = 0.5,
        center_t: float = 0.5,
        use_center: bool = True,
        use_flip: bool = True,
    ):
        import numpy as np
        import torch

        if not os.path.exists(weights_path):
            raise SystemExit(
                "weights missing at %s; run with --fetch first" % weights_path
            )
        got = sha256_file(weights_path)
        if got != WEIGHTS_SHA256:
            raise SystemExit("weights sha256 mismatch: %s != %s" % (got, WEIGHTS_SHA256))

        self.torch = torch
        self.np = np
        self.window_t = window_t
        self.center_t = center_t
        self.use_center = use_center
        self.use_flip = use_flip

        mods = import_model_modules(repo_dir)
        self.mods = mods
        self.convert = mods["convert_cvimg_to_tensor"]
        self.gen_patch = mods["generate_patch_image_cv"]

        block, layers, channels, _ = mods["resnet_spec"][18]
        backbone = mods["ResnetBackbone"](block, layers, 3)
        heatmap_head = mods["DeconvHead"](channels[-1], 3, 256, 4, 1, 5, 1)
        tagmap_head = mods["DeconvHead"](channels[-1], 3, 256, 4, 1, 4, 1)
        net = mods["PoseNet_2branch"](backbone, heatmap_head, tagmap_head)

        ckpt = torch.load(weights_path, map_location="cpu", weights_only=False)
        state = {k.replace("module.", "", 1): v for k, v in ckpt["network"].items()}
        net.load_state_dict(state, strict=True)
        net.eval()

        self.device = self._resolve_device(device)
        net.to(self.device)
        self.net = net

        from easydict import EasyDict as edict

        loss_config = edict(ae_expect_dist=12.0, ae_feat_dim=1)
        self.parser = mods["tag_group"].HeatmapParser(
            loss_config, self.use_center, self.center_t, None
        )

    def _resolve_device(self, device: str):
        torch = self.torch
        if device == "cpu":
            return torch.device("cpu")
        if device == "mps":
            return torch.device("mps")
        if device == "auto" and torch.backends.mps.is_available():
            try:
                probe = torch.zeros(1, 3, 8, 8, device="mps")
                torch.nn.functional.relu(probe)
                return torch.device("mps")
            except Exception:
                return torch.device("cpu")
        return torch.device("cpu")

    def _to_tensor(self, bgr):
        np = self.np
        h, w = bgr.shape[:2]
        patch, _ = self.gen_patch(
            bgr.copy(), w, h, PATCH, PATCH, False, [1.0, 0, np.zeros(2)]
        )
        tensor = self.convert(patch)
        for c in range(3):
            tensor[c] = np.clip(tensor[c] * 1.0, 0, 255)
            tensor[c] = (tensor[c] - MEAN[c]) / STD[c]
        return tensor

    def _forward(self, tensor):
        torch = self.torch
        x = torch.from_numpy(tensor[None]).to(self.device)
        with torch.no_grad():
            heatmaps, tagmaps = self.net(x)
            if self.use_flip:
                flipped = torch.flip(x, dims=[3])
                hm_f, tm_f = self.net(flipped)
                heatmaps = self._merge_heatmaps(heatmaps, hm_f)
                tagmaps = torch.cat((tagmaps, tm_f), dim=1)
        up = torch.nn.UpsamplingBilinear2d((PATCH, PATCH))
        return (
            up(heatmaps).cpu().numpy().astype(float),
            up(tagmaps).cpu().numpy().astype(float),
        )

    def _merge_heatmaps(self, origin, flipped_raw):
        torch = self.torch
        out = torch.flip(flipped_raw, dims=[3])
        for a, b in FLIP_PAIRS:
            tmp = out[:, a].clone()
            out[:, a] = out[:, b]
            out[:, b] = tmp
        return (origin + out) * 0.5

    def detect(self, bgr):
        """Return axis-aligned boxes [x1, y1, x2, y2, score] in image pixels."""
        np = self.np
        h, w = bgr.shape[:2]
        heatmaps, tagmaps = self._forward(self._to_tensor(bgr))
        windows = self.mods["tag_group"].group_corners_on_tags(
            0,
            self.parser,
            heatmaps[0],
            tagmaps[0],
            PATCH,
            PATCH,
            w,
            h,
            rectify=False,
            winScoreThres=self.window_t,
        )
        boxes = []
        for win in windows:
            pos = np.asarray(win["position"])
            xs, ys = pos[:, 0], pos[:, 1]
            x1 = float(max(0.0, min(w, xs.min())))
            y1 = float(max(0.0, min(h, ys.min())))
            x2 = float(max(0.0, min(w, xs.max())))
            y2 = float(max(0.0, min(h, ys.max())))
            if x2 - x1 < 1.0 or y2 - y1 < 1.0:
                continue
            boxes.append([x1, y1, x2, y2, float(win["score"])])
        return boxes


def tile_origins(dim: int, tile: int, overlap: float) -> list[int]:
    if dim <= tile:
        return [0]
    stride = max(1, int(round(tile * (1.0 - overlap))))
    origins = list(range(0, dim - tile + 1, stride))
    if origins[-1] != dim - tile:
        origins.append(dim - tile)
    return origins


def iou(a, b) -> float:
    ax1, ay1, ax2, ay2 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx1, by1, bx2, by2 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0.0


def nms(boxes: list[list[float]], threshold: float) -> list[list[float]]:
    """boxes: [along, up, widthM, heightM, score]. Greedy, deterministic."""
    order = sorted(
        range(len(boxes)), key=lambda i: (-boxes[i][4], boxes[i][0], boxes[i][1])
    )
    kept = []
    while order:
        i = order.pop(0)
        kept.append(boxes[i])
        order = [j for j in order if iou(boxes[i], boxes[j]) <= threshold]
    kept.sort(key=lambda b: (b[1], b[0]))
    return kept


def map_box(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    score: float,
    crop_w: int,
    crop_h: int,
    wall_w: float,
    wall_h: float,
) -> list[float]:
    along = (x1 / crop_w) * wall_w
    up = ((crop_h - y2) / crop_h) * wall_h
    width_m = ((x2 - x1) / crop_w) * wall_w
    height_m = ((y2 - y1) / crop_h) * wall_h
    return [along, up, width_m, height_m, score]


def plane_metrics(full: dict) -> tuple[float, float]:
    plane = full["plane"]
    start, end = plane["start"], plane["end"]
    wall_w = ((end["x"] - start["x"]) ** 2 + (end["y"] - start["y"]) ** 2) ** 0.5
    wall_h = float(plane["topZ"]) - float(plane["baseZ"])
    if wall_w <= 0 or wall_h <= 0:
        raise ValueError("non-positive plane dimensions")
    return wall_w, wall_h


def load_selection(path: str) -> dict[str, Any]:
    with open(path) as fh:
        data = json.load(fh)
    ids: list[str] | None = None
    crop_files: dict[str, str] = {}
    if isinstance(data, dict) and isinstance(data.get("elevationIds"), list):
        ids = [str(x) for x in data["elevationIds"]]
    records = data.get("records") if isinstance(data, dict) else data
    if isinstance(records, list):
        ids = ids if ids is not None else []
        for entry in records:
            if isinstance(entry, str):
                ids.append(entry)
                continue
            if not isinstance(entry, dict):
                continue
            eid = entry.get("elevationId") or entry.get("id")
            if eid is None:
                continue
            eid = str(eid)
            if eid not in ids:
                ids.append(eid)
            if entry.get("cropFile"):
                crop_files[eid] = str(entry["cropFile"])
    if ids is None:
        raise SystemExit("unsupported selection file: %s" % path)
    return {"elevationIds": ids, "cropFiles": crop_files}


def iter_manifest_records(manifest_path: str) -> Iterable[dict]:
    with open(manifest_path) as fh:
        manifest = json.load(fh)
    for record in manifest["records"]:
        yield record


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", action="append", default=[], required=False,
                    help="path to an evidence/manifest.json (repeatable)")
    ap.add_argument("--selection", help="selection.json with elevationIds/records")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--setting", choices=["R0", "R1"], default="R0")
    ap.add_argument("--out", help="output JSON path (required to run)")
    ap.add_argument("--repo", default=os.path.join(".cache", "facade-eval", "win_det_heatmaps"))
    ap.add_argument("--weights", default=os.path.join(".cache", "facade-eval", "weights", WEIGHTS_FILENAME))
    ap.add_argument("--device", choices=["auto", "cpu", "mps"], default="auto")
    ap.add_argument("--window-t", type=float, default=0.5)
    ap.add_argument("--center-t", type=float, default=0.5)
    ap.add_argument("--no-center", action="store_true")
    ap.add_argument("--no-flip", action="store_true")
    ap.add_argument("--tile-px", type=int, default=768)
    ap.add_argument("--tile-overlap", type=float, default=0.15)
    ap.add_argument("--nms-iou", type=float, default=0.5)
    ap.add_argument("--force", action="store_true", help="ignore resume cache")
    ap.add_argument("--fetch", action="store_true", help="clone repo + download weights, then exit")
    ap.add_argument("--check-weights", action="store_true", help="verify weights sha256, then exit")
    args = ap.parse_args()

    if args.fetch:
        fetch_assets(args.repo, args.weights)
        return 0
    if args.check_weights:
        got = sha256_file(args.weights) if os.path.exists(args.weights) else "missing"
        print(got)
        return 0 if got == WEIGHTS_SHA256 else 1
    if not args.manifest:
        ap.error("--manifest is required (unless --fetch/--check-weights)")
    if not args.out:
        ap.error("--out is required to run")

    started = time.time()
    detector = WindetDetector(
        args.repo,
        args.weights,
        device=args.device,
        window_t=args.window_t,
        center_t=args.center_t,
        use_center=not args.no_center,
        use_flip=not args.no_flip,
    )

    selection = load_selection(args.selection) if args.selection else None
    selection_ids = set(selection["elevationIds"]) if selection else None
    crop_override = selection["cropFiles"] if selection else {}

    records: list[dict] = []
    for manifest_path in args.manifest:
        manifest_dir = os.path.dirname(os.path.abspath(manifest_path))
        images_dir = os.path.join(manifest_dir, "images")
        for record in iter_manifest_records(manifest_path):
            elevation_id = record["elevationId"]
            if selection_ids is not None and elevation_id not in selection_ids:
                continue
            full = record.get("images", {}).get("full")
            if not full:
                continue
            records.append({
                "manifestDir": manifest_dir,
                "imagesDir": images_dir,
                "buildingId": record["buildingId"],
                "elevationId": elevation_id,
                "surfaceId": record.get("id") or elevation_id,
                "full": full,
                "cropOverride": crop_override.get(elevation_id),
            })
    if args.limit and args.limit > 0:
        records = records[: args.limit]

    cache_path = args.out + ".jsonl"
    errors_path = args.out + ".errors.jsonl"
    cache: dict[tuple, dict] = {}
    if os.path.exists(cache_path) and not args.force:
        with open(cache_path) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                cache[(entry["setting"], entry["buildingId"], entry["elevationId"])] = entry["record"]

    import cv2

    results: list[dict] = []
    durations: list[float] = []
    for i, rec in enumerate(records, 1):
        key = (args.setting, rec["buildingId"], rec["elevationId"])
        if key in cache:
            results.append(cache[key])
            continue
        t0 = time.time()
        try:
            crop_path = rec["cropOverride"] or os.path.join(
                rec["imagesDir"], rec["full"]["file"]
            )
            crop_path = os.path.abspath(crop_path)
            image = cv2.imread(
                crop_path, cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION
            )
            if image is None:
                raise IOError("could not read crop %s" % crop_path)
            crop_h, crop_w = image.shape[:2]
            wall_w, wall_h = plane_metrics(rec["full"])

            if args.setting == "R0":
                tiles = [(0, 0, image)]
            else:
                x_origins = tile_origins(crop_w, args.tile_px, args.tile_overlap)
                y_origins = tile_origins(crop_h, args.tile_px, args.tile_overlap)
                tiles = []
                for oy in y_origins:
                    for ox in x_origins:
                        th = min(args.tile_px, crop_h - oy)
                        tw = min(args.tile_px, crop_w - ox)
                        tiles.append((ox, oy, image[oy:oy + th, ox:ox + tw]))

            raw_boxes: list[list[float]] = []
            for ox, oy, tile in tiles:
                for x1, y1, x2, y2, score in detector.detect(tile):
                    raw_boxes.append(
                        map_box(
                            x1 + ox, y1 + oy, x2 + ox, y2 + oy, score,
                            crop_w, crop_h, wall_w, wall_h,
                        )
                    )
            merged = nms(raw_boxes, args.nms_iou) if len(raw_boxes) > 1 else raw_boxes

            result = {
                "buildingId": rec["buildingId"],
                "elevationId": rec["elevationId"],
                "surfaceId": rec["surfaceId"],
                "wallWidthM": round(wall_w, 4),
                "wallHeightM": round(wall_h, 4),
                "cropFile": crop_path,
                "cropWidthPx": int(crop_w),
                "cropHeightPx": int(crop_h),
                "pixelsPerMetre": round(crop_w / wall_w, 3),
                "tiles": len(tiles),
                "boxes": [
                    {
                        "kind": "window",
                        "score": round(float(b[4]), 4),
                        "along": round(float(b[0]), 4),
                        "up": round(float(b[1]), 4),
                        "widthM": round(float(b[2]), 4),
                        "heightM": round(float(b[3]), 4),
                    }
                    for b in merged
                ],
            }
        except Exception as exc:  # never crash the whole run on one crop
            with open(errors_path, "a") as fh:
                fh.write(json.dumps({
                    "setting": args.setting,
                    "buildingId": rec["buildingId"],
                    "elevationId": rec["elevationId"],
                    "error": "%s: %s" % (type(exc).__name__, exc),
                }) + "\n")
            print("[windet] skip %s: %s" % (rec["elevationId"], exc), file=sys.stderr)
            continue

        dt = time.time() - t0
        durations.append(dt)
        with open(cache_path, "a") as fh:
            fh.write(json.dumps({
                "setting": args.setting,
                "buildingId": rec["buildingId"],
                "elevationId": rec["elevationId"],
                "record": result,
            }) + "\n")
        cache[key] = result
        results.append(result)
        if i % 25 == 0 or i == len(records):
            print("[windet] %d/%d crops" % (i, len(records)), file=sys.stderr)

    payload = {
        "schemaVersion": 1,
        "lane": "windet",
        "model": MODEL_ID,
        "setting": args.setting,
        "records": results,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")

    durations.sort()
    provenance = {
        "model": MODEL_ID,
        "repoUrl": REPO_URL,
        "repoSha": REPO_SHA,
        "weightsUrl": WEIGHTS_URL,
        "weightsDownloadUrl": WEIGHTS_DOWNLOAD_URL,
        "weightsFile": os.path.abspath(args.weights),
        "weightsSha256": WEIGHTS_SHA256,
        "device": str(detector.device),
        "windowT": args.window_t,
        "centerT": args.center_t,
        "useCenter": not args.no_center,
        "useFlipTest": not args.no_flip,
        "patchPx": PATCH,
        "setting": args.setting,
        "tilePx": args.tile_px,
        "tileOverlap": args.tile_overlap,
        "nmsIou": args.nms_iou,
        "records": len(results),
        "cropsTimed": len(durations),
        "secondsPerCropMean": round(sum(durations) / len(durations), 4) if durations else None,
        "secondsPerCropMedian": round(durations[len(durations) // 2], 4) if durations else None,
        "wallClockSeconds": round(time.time() - started, 2),
    }
    with open(args.out + ".provenance.json", "w") as fh:
        json.dump(provenance, fh, indent=2)
        fh.write("\n")

    print(json.dumps({
        "out": args.out,
        "records": len(results),
        "meanSecondsPerCrop": provenance["secondsPerCropMean"],
        "medianSecondsPerCrop": provenance["secondsPerCropMedian"],
        "wallClockSeconds": provenance["wallClockSeconds"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
