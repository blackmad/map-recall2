#!/usr/bin/env python3
"""
Run the UnderOneFacade PTv1 (Point Transformer v1) façade segmentation model on
Amsterdam MLS tiles and emit per-point class predictions.

The model and its pointops CUDA extension are 2019-era and call
`torch.cuda.synchronize()` unconditionally, so this script requires a CUDA GPU.

Inference strategy (matches the plan): slide ~1.5 m XY windows with overlap over
the tile, and for every window repeat `datasets/facade_dataset.py`'s
`PointOffsetDataset` normalisation exactly:

    coords -= coords.mean(0)
    d = sqrt((coords ** 2).sum(1)).max()
    coords /= (d + 1e-6)

(`feature_columns` is `[0, 1, 2]`, so `feat == coords`.) Windows are
offset-batched through the model, softmaxed, and each original point gets the
majority class over every window that contained it.

Input: a `(N, 8)` float32 `.npy` in the tile's RD/NAP frame with columns
`[X, Y, Z, R, G, B, Intensity, Label]` (see convert-tile-npy.ts).
Output: `(N,)` int8 predictions in tile point order (`-1` = no window reached
the point) plus a JSON summary.

Usage:
    python infer_ptv1.py \
        --code-root /workspace/underonefacade \
        --weights /workspace/underonefacade/PT_lofg3_xyz.pth \
        --npy /workspace/tiles/filtered_2397_9705.npy \
        --out-dir /workspace/preds
"""

import argparse
import json
import os
import sys
import time
import types

import numpy as np

# Class names for the two label hierarchies (config.yaml labels.*.names).
LOFG3_NAMES = [
    "wall", "window", "door", "balcony", "molding", "deco+", "column", "arch",
    "stairs", "ground surface", "terrain", "roof", "blinds", "interior", "other",
]
LOFG2_NAMES = ["structural", "opening", "decoration", "floor", "other"]


def ensure_code_importable(code_root: str) -> None:
    """Make `models.ptv1` importable even though the release omits __init__.py.

    The Drive folder ships no `models/__init__.py`, so `from . import
    register_engine` in models/ptv1.py would fail. We pre-register a namespace
    module with a no-op decorator; we never use `get_engine`. We also write the
    missing `functions/__init__.py` for the pointops package (the extension is
    installed from `functions/` via `package_dir`).
    """
    if code_root not in sys.path:
        sys.path.insert(0, code_root)

    functions_init = os.path.join(code_root, "models", "pointops_lib", "functions", "__init__.py")
    if not os.path.exists(functions_init):
        with open(functions_init, "w") as handle:
            handle.write(
                "from .query import knn_query, ball_query, random_ball_query\n"
                "from .sampling import farthest_point_sampling\n"
                "from .grouping import grouping, grouping2\n"
                "from .interpolation import interpolation\n"
                "from .subtraction import subtraction\n"
                "from .aggregation import aggregation\n"
                "from .attention import attention_relation_step, attention_fusion_step\n"
                "from .utils import (\n"
                "    query_and_group, knn_query_and_group, ball_query_and_group,\n"
                "    offset2batch, batch2offset,\n"
                ")\n"
            )
        print(f"wrote missing {functions_init}")

    if "models" not in sys.modules:
        package = types.ModuleType("models")
        package.__path__ = [os.path.join(code_root, "models")]
        package.register_engine = lambda _name: (lambda cls: cls)
        sys.modules["models"] = package


def normalise_window(coords: np.ndarray) -> np.ndarray:
    """Exact per-scene normalisation from datasets/facade_dataset.py."""
    coords = coords.astype(np.float32, copy=True)
    coords -= coords.mean(0)
    d = np.sqrt((coords ** 2).sum(1)).max()
    coords /= (d + 1e-6)
    return coords


def build_window_centres(bounds, window: float, stride: float):
    min_x, min_y, max_x, max_y = bounds
    xs = np.arange(min_x, max_x - window + stride * 0.5, stride)
    ys = np.arange(min_y, max_y - window + stride * 0.5, stride)
    centres = np.array([(x, y) for y in ys for x in xs], dtype=np.float64)
    return centres


def build_xy_grid(xy: np.ndarray, bounds, cell: float):
    """Bucket point indices into a uniform XY grid for fast window gathering."""
    min_x, min_y = bounds[0], bounds[1]
    width = int(np.ceil((bounds[2] - min_x) / cell)) + 1
    height = int(np.ceil((bounds[3] - min_y) / cell)) + 1
    cx = np.clip(((xy[:, 0] - min_x) / cell).astype(np.int64), 0, width - 1)
    cy = np.clip(((xy[:, 1] - min_y) / cell).astype(np.int64), 0, height - 1)
    flat = cy * width + cx
    order = np.argsort(flat, kind="stable")
    sorted_flat = flat[order]
    boundaries = np.searchsorted(sorted_flat, np.arange(width * height + 1))
    return order, boundaries, width, height


def window_indices(centre, grid, bounds, window, z_range):
    """Indices of points inside the XY window at `centre`, bounded in Z.

    `build_xy_grid` cell size equals `window`, so a centre can reach up to a 3x3
    block of cells; the caller must still mask to the exact square. Crucially the
    Z bound keeps the slice to a ~1.5 m cube: the model normalises each scene by
    the max radius from the scene mean, so a full-height column (50 m tall) would
    shrink the 1.5 m façade cube to a few percent of the radius and the model
    would read it as terrain.
    """
    order, boundaries, width, height = grid
    min_x, min_y = bounds[0], bounds[1]
    cell = window
    x0, y0 = centre[0], centre[1]
    first = int(np.floor((x0 - min_x) / cell)) - 1
    last = int(np.floor((x0 - min_x) / cell)) + 1
    first_y = int(np.floor((y0 - min_y) / cell)) - 1
    last_y = int(np.floor((y0 - min_y) / cell)) + 1
    chunks = []
    for cy in range(max(0, first_y), min(height - 1, last_y) + 1):
        for cx in range(max(0, first), min(width - 1, last) + 1):
            begin, end = boundaries[cy * width + cx], boundaries[cy * width + cx + 1]
            if end > begin:
                chunks.append(order[begin:end])
    if not chunks:
        return np.empty(0, dtype=np.int64)
    return np.concatenate(chunks)


def load_model(code_root, weights_path, device):
    import torch

    ensure_code_importable(code_root)
    import models.ptv1 as ptv1

    checkpoint = torch.load(weights_path, map_location="cpu", weights_only=False)
    if "model_state_dict" in checkpoint:
        state = checkpoint["model_state_dict"]
    elif "state_dict" in checkpoint:
        state = checkpoint["state_dict"]
    else:
        state = checkpoint
    state = {k.replace("module.", ""): v for k, v in state.items()}

    in_planes = int(state["enc1.0.linear.weight"].shape[1])
    in_channels = 3 if in_planes == 3 else in_planes - 3
    if in_channels != 3:
        raise SystemExit(
            f"weights expect {in_channels} feature channels; this script only "
            "implements the xyz (3-channel) weights"
        )
    num_classes = int(state["cls.3.weight"].shape[0]) if "cls.3.weight" in state else 15

    model = ptv1.PointTransformerSeg(num_classes=num_classes, in_channels=3, blocks=[1, 2, 2, 2, 2])
    missing, unexpected = model.load_state_dict(state, strict=False)
    model = model.to(device).eval()
    print(f"loaded {weights_path}: in_planes={in_planes}, classes={num_classes}, "
          f"missing={len(missing)}, unexpected={len(unexpected)}")
    return model, num_classes


def infer_tile(model, num_classes, array, args, device):
    import torch

    xyz = np.ascontiguousarray(array[:, :3], dtype=np.float32)
    bounds = (float(xyz[:, 0].min()), float(xyz[:, 1].min()),
              float(xyz[:, 0].max()), float(xyz[:, 1].max()))
    n = xyz.shape[0]
    print(f"tile points={n} bounds={bounds} window={args.window} stride={args.stride}")

    grid = build_xy_grid(xyz[:, :2], bounds, args.window)
    centres = build_window_centres(bounds, args.window, args.stride)
    if args.limit_windows:
        centres = centres[: args.limit_windows]
    print(f"windows={len(centres)}")

    votes = np.zeros((n, num_classes), dtype=np.uint8)
    counts = np.zeros(n, dtype=np.uint8)
    rng = np.random.default_rng(args.seed)

    # The model sees a cube, so slide the window in Z too. Each XY column is
    # processed in slab-height steps so a window never spans more than a storey.
    z_min = float(xyz[:, 2].min())
    z_max = float(xyz[:, 2].max())
    z_edges = np.arange(z_min, z_max + 1e-6, args.z_stride)
    if z_edges.size == 0:
        z_edges = np.array([z_min])
    print(f"z range {z_min:.1f}..{z_max:.1f}, z_stride={args.z_stride}, "
          f"z slabs per column={len(z_edges)}")

    processed = 0
    started = time.time()

    def flush(batch_coords, batch_feats, batch_offsets, batch_origin):
        coords = torch.from_numpy(np.concatenate(batch_coords, 0)).float().to(device)
        feats = torch.from_numpy(np.concatenate(batch_feats, 0)).float().to(device)
        offset = torch.tensor(batch_offsets, dtype=torch.long, device=device)
        with torch.no_grad():
            logits = model([coords, feats, offset])
            probs = torch.softmax(logits, dim=1)
        predicted = probs.argmax(1).to(torch.uint8).cpu().numpy()
        cursor = 0
        for origin in batch_origin:
            length = origin.shape[0]
            label = predicted[cursor:cursor + length]
            cursor += length
            valid = counts[origin] < 250
            target = origin[valid]
            np.add.at(votes, (target, label[valid]), 1)
            counts[target] += 1

    batch_coords, batch_feats, batch_offsets, batch_origin = [], [], [], []
    batch_points = 0
    for centre in centres:
        column = window_indices(centre, grid, bounds, args.window, None)
        if column.size == 0:
            continue
        column_z = xyz[column, 2]
        for z0 in z_edges:
            z1 = z0 + args.window
            indices = column[(column_z >= z0) & (column_z <= z1)]
            if indices.size < args.min_points:
                continue
            coords = xyz[indices]
            inside = (
                (coords[:, 0] >= centre[0]) & (coords[:, 0] <= centre[0] + args.window)
                & (coords[:, 1] >= centre[1]) & (coords[:, 1] <= centre[1] + args.window)
            )
            indices = indices[inside]
            if indices.size < args.min_points:
                continue
            if indices.size > args.num_point:
                indices = rng.choice(indices, size=args.num_point, replace=False)
            coords = normalise_window(xyz[indices])
            batch_coords.append(coords)
            batch_feats.append(coords)
            batch_offsets.append(batch_points + coords.shape[0])
            batch_origin.append(indices)
            batch_points += coords.shape[0]
            processed += 1
            if len(batch_coords) >= args.batch_windows or batch_points >= args.max_batch_points:
                flush(batch_coords, batch_feats, batch_offsets, batch_origin)
                batch_coords, batch_feats, batch_offsets, batch_origin = [], [], [], []
                batch_points = 0
                if processed % 500 == 0:
                    elapsed = time.time() - started
                    print(f"  {processed}/{len(centres) * len(z_edges)} windows, "
                          f"{elapsed:.1f}s, {processed / max(elapsed, 1e-9):.1f} win/s", flush=True)
    if batch_coords:
        flush(batch_coords, batch_feats, batch_offsets, batch_origin)

    total = time.time() - started
    print(f"done {processed} windows in {total:.1f}s ({processed / max(total, 1e-9):.1f} win/s)")
    labels = np.full(n, -1, dtype=np.int8)
    reached = votes.sum(1) > 0
    labels[reached] = votes[reached].argmax(1).astype(np.int8)
    return labels, votes, reached, processed, total


def main() -> int:
    parser = argparse.ArgumentParser("PTv1 inference on an MLS tile")
    parser.add_argument("--code-root", required=True)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--npy", required=True, action="append", dest="npys")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--window", type=float, default=1.5)
    parser.add_argument("--stride", type=float, default=0.75)
    parser.add_argument("--z-stride", type=float, default=1.0)
    parser.add_argument("--num-point", type=int, default=8192)
    parser.add_argument("--batch-windows", type=int, default=8)
    parser.add_argument("--max-batch-points", type=int, default=131072)
    parser.add_argument("--min-points", type=int, default=64)
    parser.add_argument("--seed", type=int, default=999)
    parser.add_argument("--limit-windows", type=int, default=0)
    parser.add_argument("--device", default="cuda")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    model, num_classes = load_model(args.code_root, args.weights, args.device)

    summaries = []
    for npy_path in args.npys:
        array = np.load(npy_path, mmap_mode="r")
        name = os.path.splitext(os.path.basename(npy_path))[0]
        labels, votes, reached, windows, seconds = infer_tile(model, num_classes, array, args, args.device)
        out_labels = os.path.join(args.out_dir, f"{name}.pred.npy")
        np.save(out_labels, labels)
        histogram = {LOFG3_NAMES[i]: int((labels == i).sum()) for i in range(num_classes)}
        summary = {
            "tile": name,
            "points": int(labels.shape[0]),
            "pointsPredicted": int(reached.sum()),
            "pointsUnreached": int((~reached).sum()),
            "windows": windows,
            "seconds": round(seconds, 1),
            "windowsPerSecond": round(windows / max(seconds, 1e-9), 2),
            "windowM": args.window,
            "strideM": args.stride,
            "zStrideM": args.z_stride,
            "numPoint": args.num_point,
            "labelsFile": os.path.basename(out_labels),
            "classHistogram": histogram,
        }
        summaries.append(summary)
        print(json.dumps(summary, indent=2))

    with open(os.path.join(args.out_dir, "summary.json"), "w") as handle:
        json.dump({"weights": os.path.basename(args.weights), "tiles": summaries}, handle, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
