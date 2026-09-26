#!/usr/bin/env python
"""Run the UnderOneFacade DGCNN façade segmentation model on an MLS tile.

This is the point-cloud lane (D) of FACADE_MODEL_EVALUATION_PLAN.md §9. It is
pure PyTorch, so it runs locally on CPU or Apple MPS with no CUDA / spconv /
pointops build.

Pipeline (mirrors the upstream `BlockDataset` exactly for xyz-only features):

  1. Read the (N, 8) float32 tile `.npy` written by `export-tile-npy.ts`.
  2. Slide a `--block-size` metre XY window with `--stride` overlap across the
     tile. For each window the upstream sampler:
        - keeps points inside [ctr +/- block_size/2] in x and y,
        - samples exactly `num_point` of them (with replacement if fewer),
        - centres the sampled xyz on its own mean and divides by its own max
          radius (`d + 1e-6`).
     Because `--features xyz`, the normalised xyz *is* the feature vector.
  3. Forward the block, softmax the (B, N, C) logits, and add the per-point
     class probabilities back onto the source points (per-point vote).
  4. Argmax the accumulated probability -> one label per tile point.

Outputs next to `--out`:
  * the label array (`uint8`, (N,)),
  * `<out>.conf.npy` (`float16`, (N,)) the winning mean probability,
  * `<out>.provenance.json` timing and settings.

Usage:
  .cache/facade-eval/venv-dgcnn/bin/python scripts/facade-eval/pointcloud/infer_dgcnn.py \
      --npy .cache/facade-eval/dgcnn/tiles/filtered_2397_9705.npy \
      --weights .cache/underonefacade/weights/DGCNN_lofg3_xyz.pth --lofg lofg3 \
      --out .cache/facade-eval/dgcnn/preds/filtered_2397_9705.npy
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import torch

# The upstream code lives in a cache dir with no models/__init__.py. Write the
# minimal registry the first time so `from models import get_engine` works.
MODELS_INIT = '''"""Minimal engine registry (written by infer_dgcnn.py)."""
import importlib

_ENGINES = {}
_OPTIONAL = ("pointnet", "dgcnn", "pointnet2", "ptv1", "ptv3", "kpconv", "octformer")


def register_engine(name):
    def decorator(cls):
        _ENGINES[name] = cls
        return cls
    return decorator


def get_engine(name):
    if name not in _ENGINES:
        _load_optional(name)
    if name not in _ENGINES:
        raise KeyError(f"Unknown engine '{name}'. Registered: {sorted(_ENGINES)}")
    return _ENGINES[name]


def _load_optional(name):
    if name not in _OPTIONAL:
        return
    try:
        importlib.import_module(f"{__name__}.{name}")
    except Exception:
        pass


try:
    importlib.import_module(f"{__name__}.dgcnn")
except Exception:
    pass
'''


def ensure_models_init(code_dir: Path) -> None:
    target = code_dir / "models" / "__init__.py"
    if not target.exists():
        target.write_text(MODELS_INIT)
        print(f"[setup] wrote missing {target}")


def remap_state_dict(state: dict) -> dict:
    """Strip DataParallel `module.` and wrapper `net.` prefixes."""
    out = {}
    for key, value in state.items():
        name = key
        if name.startswith("module."):
            name = name[len("module."):]
        if name.startswith("net."):
            name = name[len("net."):]
        out[name] = value
    return out


def resolve_device(requested: str) -> torch.device:
    if requested == "auto":
        if torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    return torch.device(requested)


def build_block_grid(bounds, block_size: float, stride: float):
    """Return the sliding-window centres covering the tile's XY bounds."""
    min_x, min_y, max_x, max_y = bounds
    half = block_size / 2.0
    step = max(stride, 1e-3)
    xs = np.arange(min_x + half, max_x - half + step, step)
    ys = np.arange(min_y + half, max_y - half + step, step)
    if xs.size == 0:
        xs = np.array([(min_x + max_x) / 2])
    if ys.size == 0:
        ys = np.array([(min_y + max_y) / 2])
    grid_x, grid_y = np.meshgrid(xs, ys, indexing="xy")
    return np.stack([grid_x.ravel(), grid_y.ravel()], axis=1)


class GridIndex:
    """Uniform XY bucket index so a window touches only a few buckets."""

    def __init__(self, xyz: np.ndarray, cell: float):
        self.cell = cell
        self.min_xy = xyz[:, :2].min(axis=0)
        size = xyz[:, :2].max(axis=0) - self.min_xy
        self.nx = max(1, int(np.floor(size[0] / cell)) + 1)
        self.ny = max(1, int(np.floor(size[1] / cell)) + 1)
        ix = np.clip(np.floor((xyz[:, 0] - self.min_xy[0]) / cell).astype(np.int64), 0, self.nx - 1)
        iy = np.clip(np.floor((xyz[:, 1] - self.min_xy[1]) / cell).astype(np.int64), 0, self.ny - 1)
        cid = ix * self.ny + iy
        order = np.argsort(cid, kind="stable")
        self.order = order
        self.sorted_cid = cid[order]
        self.sorted_cid = np.ascontiguousarray(self.sorted_cid)

    def cells_for(self, cx: float, cy: float, half: float):
        lo_ix = int(np.floor((cx - half - self.min_xy[0]) / self.cell))
        hi_ix = int(np.floor((cx + half - self.min_xy[0]) / self.cell))
        lo_iy = int(np.floor((cy - half - self.min_xy[1]) / self.cell))
        hi_iy = int(np.floor((cy + half - self.min_xy[1]) / self.cell))
        lo_ix = max(0, lo_ix)
        lo_iy = max(0, lo_iy)
        hi_ix = min(self.nx - 1, hi_ix)
        hi_iy = min(self.ny - 1, hi_iy)
        parts = []
        for ix in range(lo_ix, hi_ix + 1):
            for iy in range(lo_iy, hi_iy + 1):
                cid = ix * self.ny + iy
                start = np.searchsorted(self.sorted_cid, cid, side="left")
                end = np.searchsorted(self.sorted_cid, cid, side="right")
                if end > start:
                    parts.append(self.order[start:end])
        if not parts:
            return np.empty(0, dtype=np.int64)
        return np.concatenate(parts)


def parse_args(argv=None):
    p = argparse.ArgumentParser("UnderOneFacade DGCNN tile inference")
    p.add_argument("--npy", required=True, help="(N, 8) float32 tile from export-tile-npy.ts")
    p.add_argument("--out", required=True, help="output label .npy path")
    p.add_argument("--code-dir", default=".cache/underonefacade/code")
    p.add_argument("--weights", default=None, help="DGCNN .pth (default: weights/<lofg>_xyz.pth)")
    p.add_argument("--lofg", default="lofg3", choices=["lofg2", "lofg3"])
    p.add_argument("--block-size", type=float, default=1.5, help="metres, upstream default 1.0")
    p.add_argument("--stride", type=float, default=1.0, help="metres between window centres")
    p.add_argument("--num-point", type=int, default=4096)
    p.add_argument("--min-block-points", type=int, default=50, help="skip windows with fewer returns")
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--device", default="auto", choices=["auto", "cpu", "mps"])
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--limit-blocks", type=int, default=0, help="smoke-test: stop after N blocks")
    p.add_argument("--progress-every", type=int, default=50)
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    code_dir = Path(args.code_dir).resolve()
    ensure_models_init(code_dir)
    sys.path.insert(0, str(code_dir))

    from models.dgcnn import DGCNNSemSeg  # noqa: E402

    weights = args.weights
    if weights is None:
        weights = str(Path(".cache/underonefacade/weights") / f"DGCNN_{args.lofg}_xyz.pth")
    weights = Path(weights).resolve()

    npy_path = Path(args.npy).resolve()
    arr = np.load(npy_path)
    if arr.ndim != 2 or arr.shape[1] < 8:
        raise SystemExit(f"expected (N, 8) tile, got {arr.shape}")
    xyz = np.ascontiguousarray(arr[:, :3]).astype(np.float32)
    n_points = xyz.shape[0]
    del arr

    checkpoint = torch.load(weights, map_location="cpu", weights_only=False)
    state = remap_state_dict(checkpoint["state_dict"])
    num_classes = 5 if args.lofg == "lofg2" else 15
    model = DGCNNSemSeg(num_classes=num_classes, in_channels=3)
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing or unexpected:
        raise SystemExit(
            f"weight mismatch for {weights}: {len(missing)} missing, {len(unexpected)} unexpected\n"
            f"  missing[:5]={missing[:5]}\n  unexpected[:5]={unexpected[:5]}"
        )

    device = resolve_device(args.device)
    model = model.to(device).eval()
    print(f"[model] {weights.name} lofg={args.lofg} classes={num_classes} device={device}")

    bounds = (
        float(xyz[:, 0].min()), float(xyz[:, 1].min()),
        float(xyz[:, 0].max()), float(xyz[:, 1].max()),
    )
    centres = build_block_grid(bounds, args.block_size, args.stride)
    total_grid_blocks = int(centres.shape[0])
    half = args.block_size / 2.0
    cell = max(args.stride, args.block_size - args.stride, 0.05)
    index = GridIndex(xyz, cell)

    rng = np.random.default_rng(args.seed)
    score_sum = np.zeros((n_points, num_classes), dtype=np.float32)
    score_count = np.zeros(n_points, dtype=np.uint16)

    batch_feats: list[np.ndarray] = []
    batch_src: list[np.ndarray] = []
    block_times: list[float] = []
    blocks_run = 0
    blocks_skipped = 0
    points_covered = 0
    start_all = time.perf_counter()

    def flush() -> None:
        nonlocal batch_feats, batch_src
        if not batch_feats:
            return
        stacked = torch.from_numpy(np.stack(batch_feats)).float().to(device)  # (B, N, C) -> need (B, C, N)
        stacked = stacked.transpose(2, 1).contiguous()
        t0 = time.perf_counter()
        with torch.no_grad():
            logits = model(stacked)
            probs = torch.softmax(logits, dim=-1)
            if device.type == "mps":
                torch.mps.synchronize()
        block_times.append((time.perf_counter() - t0) / len(batch_feats))
        probs_np = probs.detach().to("cpu").numpy()
        for bi, src in enumerate(batch_src):
            score_sum[src] += probs_np[bi]
            score_count[src] += 1
        batch_feats = []
        batch_src = []

    for block_index in range(total_grid_blocks):
        cx, cy = centres[block_index]
        candidates = index.cells_for(float(cx), float(cy), half)
        if candidates.size == 0:
            blocks_skipped += 1
            continue
        # Exact XY window test (buckets are a superset).
        px = xyz[candidates, 0]
        py = xyz[candidates, 1]
        inside = (px >= cx - half) & (px <= cx + half) & (py >= cy - half) & (py <= cy + half)
        window = candidates[inside]
        if window.size < args.min_block_points:
            blocks_skipped += 1
            continue
        if window.size >= args.num_point:
            chosen = rng.choice(window, size=args.num_point, replace=False)
        else:
            chosen = rng.choice(window, size=args.num_point, replace=True)
        block = xyz[chosen]
        centred = block - block.mean(axis=0)
        radius = float(np.sqrt((centred ** 2).sum(axis=1)).max())
        normalised = (centred / (radius + 1e-6)).astype(np.float32)
        batch_feats.append(normalised)
        batch_src.append(chosen)
        points_covered += int(np.unique(window).size)
        blocks_run += 1
        if len(batch_feats) >= args.batch_size:
            flush()
        if args.progress_every and blocks_run % args.progress_every == 0:
            elapsed = time.perf_counter() - start_all
            print(f"[run] {blocks_run} blocks, {len(block_times)} batched, "
                  f"{elapsed:.1f}s, {elapsed / max(blocks_run, 1) * 1000:.0f} ms/block")
        if args.limit_blocks and blocks_run >= args.limit_blocks:
            break
    flush()

    total_elapsed = time.perf_counter() - start_all
    mean_per_block = float(np.mean(block_times)) if block_times else float("nan")
    median_per_block = float(np.median(block_times)) if block_times else float("nan")
    # Extrapolate to the whole tile from the fraction of the grid processed, so
    # a --limit-blocks smoke run still reports a full-tile projection. Skipped
    # (empty) windows are cheap and are included in the processed fraction.
    grid_processed = blocks_run + blocks_skipped
    projected_full = total_elapsed * total_grid_blocks / grid_processed if grid_processed else float("nan")

    print("[timing]")
    print(f"  grid windows       {total_grid_blocks}")
    print(f"  windows run        {blocks_run} (skipped {blocks_skipped})")
    print(f"  batched forwards   {len(block_times)}")
    print(f"  mean s/block       {mean_per_block:.4f}")
    print(f"  median s/block     {median_per_block:.4f}")
    print(f"  projected full tile {projected_full:.1f} s ({projected_full / 60:.1f} min) "
          f"for {total_grid_blocks} grid windows")
    print(f"  wall clock         {total_elapsed:.1f} s")
    print(f"  point coverage     {points_covered:,} votes / {n_points:,} points")
    if (score_count == 0).any():
        print(f"  WARNING: {int((score_count == 0).sum()):,} points received no block vote")

    labels = np.zeros(n_points, dtype=np.uint8)
    confidence = np.zeros(n_points, dtype=np.float32)
    voted = score_count > 0
    mean_scores = np.zeros_like(score_sum)
    mean_scores[voted] = score_sum[voted] / score_count[voted, None]
    labels[voted] = np.argmax(mean_scores[voted], axis=1).astype(np.uint8)
    confidence[voted] = mean_scores[voted].max(axis=1)

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(out_path, labels)
    np.save(out_path.with_name(out_path.name + ".conf.npy"), confidence.astype(np.float16))

    opening_classes = [1, 2] if args.lofg == "lofg3" else [1]
    class_counts = {int(c): int((labels == c).sum()) for c in range(num_classes)}
    opening_points = int(np.isin(labels, opening_classes).sum())
    provenance = {
        "schemaVersion": 1,
        "kind": "facade-eval/dgcnn-predictions",
        "model": f"UnderOneFacade/DGCNN ({args.lofg}, xyz)",
        "weights": {"path": str(weights), "sha256": __import__("hashlib").sha256(weights.read_bytes()).hexdigest()},
        "input": {"npy": str(npy_path), "points": n_points, "bounds": bounds},
        "settings": {
            "blockSizeM": args.block_size, "strideM": args.stride,
            "numPoint": args.num_point, "minBlockPoints": args.min_block_points,
            "batchSize": args.batch_size, "device": str(device), "seed": args.seed,
            "normalisation": "per-block: xyz -= mean; xyz /= max_radius (+1e-6)",
        },
        "counts": {
            "gridBlocks": total_grid_blocks, "blocksRun": blocks_run,
            "blocksSkipped": blocks_skipped, "batchedForwards": len(block_times),
            "points": n_points, "pointsWithoutVote": int((score_count == 0).sum()),
            "openingPoints": opening_points, "classCounts": class_counts,
        },
        "timing": {
            "seconds": total_elapsed,
            "meanSecondsPerBlock": mean_per_block,
            "medianSecondsPerBlock": median_per_block,
            "projectedFullTileSeconds": projected_full,
        },
        "outputs": {
            "labels": str(out_path),
            "confidence": str(out_path.with_name(out_path.name + ".conf.npy")),
        },
        "openingClasses": opening_classes,
    }
    with out_path.with_name(out_path.name + ".provenance.json").open("w") as handle:
        json.dump(provenance, handle, indent=2)
        handle.write("\n")
    print(f"wrote {out_path}")
    print(f"opening points ({opening_classes}) {opening_points:,} / {n_points:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
