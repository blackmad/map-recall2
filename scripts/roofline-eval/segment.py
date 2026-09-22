#!/usr/bin/env python3
"""Roofline task A1: segment rectified facade strips into the §4 label contract.

Two methods, both writing one uint8 PNG per strip with the shared contract:

    0   other
    1   sky
    2   building (including roof)
    3   occluder (vegetation, pole, traffic sign, vehicle, person)
    255 unknown

`s1` (default) runs Mask2Former, Mapillary Vistas semantic
(`facebook/mask2former-swin-large-mapillary-vistas-semantic`) locally on Apple
MPS or CPU. The strip is tiled so the model input long side is never squashed
below `--long-side` px (default 1024): each tile is aspect-preserving resized so
its long side is `--long-side`, edge-padded to a multiple of 32, run, and the
label map is mapped back to the tile. Overlapping tiles are stitched
first-write-wins.

`af2` converts existing Roboflow `amsterdam-facade/2` masks
(`background,building,door,sky,window`) to the contract without re-running the
model: `sky -> 1`, `building/door/window -> 2`, `background -> 255`.

The script never downloads a model itself; `--model-dir` must already hold the
pinned snapshot (see the A1 report for the revision and sha256). Outputs are
written under `--out` (default `$ROOFLINE_CACHE/roofline-eval`). No hosted
inference is used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import numpy as np
import torch
from PIL import Image

CONTRACT_NAMES = {0: "other", 1: "sky", 2: "building", 3: "occluder", 255: "unknown"}

MODEL_ID = "facebook/mask2former-swin-large-mapillary-vistas-semantic"
MODEL_REVISION = "4772b6bf101d91f2534c106dc524d906aeb3c68a"
WEIGHTS_FILE = "model.safetensors"
WEIGHTS_SHA256 = "72721afb6894c0b1239b9259c428996d9ca0aecbebc4efb4a2deaae0403e2ea7"

# Mapillary Vistas id -> §4 contract. Everything not listed maps to `other`.
# Vistas has no wire class; wires are not representable and are called out in
# the provenance notes.
VISTAS_TO_CONTRACT = {
    17: 2,                       # Building
    6: 2,                        # Wall
    27: 1,                       # Sky
    30: 3,                       # Vegetation
    45: 3, 47: 3,                # Pole, Utility Pole
    48: 3, 46: 3, 49: 3, 50: 3,  # Traffic Light, Traffic Sign Frame/(Back)/(Front)
    19: 3,                       # Person
    0: 3, 1: 3,                  # Bird, Ground Animal
    20: 3, 21: 3, 22: 3,         # Bicyclist, Motorcyclist, Other Rider
    52: 3, 53: 3, 54: 3, 55: 3, 56: 3, 57: 3, 58: 3,
    59: 3, 60: 3, 61: 3, 62: 3, 63: 3, 64: 3,  # vehicles, incl. ego/car-mount
}
VISTAS_IGNORE_INDEX = 65

AF2_CLASS_ORDER = ["background", "building", "door", "sky", "window"]
# sky -> 1, building/door/window -> 2, background -> 255
AF2_TO_CONTRACT = {0: 255, 1: 2, 2: 2, 3: 1, 4: 2}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def contract_lut(mapping: dict[int, int], ignore_index: int) -> np.ndarray:
    lut = np.zeros(256, dtype=np.uint8)
    for k, v in mapping.items():
        lut[k] = v
    lut[ignore_index] = 255
    return lut


def tile_starts(length: int, tile: int, overlap: int) -> list[int]:
    if length <= tile:
        return [0]
    step = max(1, tile - overlap)
    starts = list(range(0, length - tile + 1, step))
    if starts[-1] + tile < length:
        starts.append(length - tile)
    return starts


def tiles_for(width: int, height: int, tile: int, overlap: int):
    if max(width, height) <= tile:
        return [(0, 0, width, height)]
    out = []
    if width >= height:
        for x in tile_starts(width, tile, overlap):
            out.append((x, 0, min(x + tile, width), height))
    else:
        for y in tile_starts(height, tile, overlap):
            out.append((0, y, width, min(y + tile, height)))
    return out


def preprocess_tile(crop: np.ndarray, long_side: int, mean, std, multiple: int
                    ) -> tuple[torch.Tensor, int, int]:
    """Aspect-preserving resize of a tile so its long side is `long_side`, then
    edge-pad to a multiple of `multiple`. Returns the tensor and the valid H,W."""
    th, tw = crop.shape[:2]
    scale = long_side / max(th, tw)
    nh, nw = max(1, round(th * scale)), max(1, round(tw * scale))
    if (nh, nw) != (th, tw):
        crop = np.array(Image.fromarray(crop).resize((nw, nh), Image.Resampling.BILINEAR))
    pad_h = (-nh) % multiple
    pad_w = (-nw) % multiple
    if pad_h or pad_w:
        crop = np.pad(crop, ((0, pad_h), (0, pad_w), (0, 0)), mode="edge")
    arr = crop.astype(np.float32) / 255.0
    arr = (arr - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    tensor = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0).contiguous()
    return tensor, nh, nw


def pick_device(requested: str) -> str:
    if requested != "auto":
        return requested
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class VistasSegmenter:
    def __init__(self, model_dir: Path, device: str, long_side: int, tile: int,
                 overlap: int):
        from transformers import (Mask2FormerForUniversalSegmentation,
                                  Mask2FormerImageProcessor)

        self.model = Mask2FormerForUniversalSegmentation.from_pretrained(str(model_dir))
        self.processor = Mask2FormerImageProcessor.from_pretrained(str(model_dir))
        self.device = device
        self.model.to(device).eval()
        self.long_side = long_side
        self.tile = tile
        self.overlap = overlap
        self.mean = self.processor.image_mean
        self.std = self.processor.image_std
        self.multiple = int(self.processor.size_divisor or 32)
        self.lut = contract_lut(VISTAS_TO_CONTRACT, VISTAS_IGNORE_INDEX)

    def segment(self, rgb: np.ndarray) -> tuple[np.ndarray, int]:
        h, w = rgb.shape[:2]
        labels = np.zeros((h, w), dtype=np.uint8)
        assigned = np.zeros((h, w), dtype=bool)
        tiles = tiles_for(w, h, self.tile, self.overlap)
        for (x0, y0, x1, y1) in tiles:
            crop = np.ascontiguousarray(rgb[y0:y1, x0:x1])
            tensor, nh, nw = preprocess_tile(
                crop, self.long_side, self.mean, self.std, self.multiple)
            tensor = tensor.to(self.device)
            with torch.inference_mode():
                outputs = self.model(pixel_values=tensor)
                ph, pw = tensor.shape[-2:]
                semantic = self.processor.post_process_semantic_segmentation(
                    outputs, target_sizes=[(ph, pw)])[0]
            sem = semantic[:nh, :nw].detach().to("cpu").numpy().astype(np.uint8)
            tile_labels = self.lut[sem]
            th, tw = crop.shape[:2]
            if (nh, nw) != (th, tw):
                tile_labels = np.array(Image.fromarray(tile_labels).resize(
                    (tw, th), Image.Resampling.NEAREST))
            region = ~assigned[y0:y1, x0:x1]
            labels[y0:y1, x0:x1] = np.where(region, tile_labels,
                                            labels[y0:y1, x0:x1])
            assigned[y0:y1, x0:x1] = True
        return labels, len(tiles)


def class_share(mask: np.ndarray) -> dict:
    total = mask.size
    return {name: round(float((mask == value).sum()) / total, 4)
            for value, name in sorted(CONTRACT_NAMES.items())}


def load_manifest(strips_dir: Path) -> dict:
    manifest_path = strips_dir / "manifest.json"
    data = json.loads(manifest_path.read_text())
    records = {}
    for s in data.get("strips", []):
        records[s["file"]] = s
    return {"meta": data.get("metadata", {}), "byFile": records,
            "sha256": sha256_file(manifest_path)}


def run_s1(args) -> None:
    import transformers

    strips_dir = args.strips
    out_dir = args.out
    masks_dir = out_dir / "masks" / "s1"
    masks_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest(strips_dir)
    jpgs = sorted(p for p in strips_dir.iterdir()
                  if p.suffix.lower() in (".jpg", ".jpeg", ".png")
                  and not p.name.endswith(".mask.png"))
    if args.limit:
        jpgs = jpgs[:args.limit]

    model_dir = args.model_dir
    weights = model_dir / WEIGHTS_FILE
    weights_sha = sha256_file(weights)
    if weights_sha != WEIGHTS_SHA256:
        raise SystemExit(
            f"Model weights sha256 {weights_sha} != pinned {WEIGHTS_SHA256}; "
            "review provenance before replacing the model.")

    device = pick_device(args.device)
    print(f"s1 model={MODEL_ID}@{MODEL_REVISION} device={device} "
          f"weights_sha256={weights_sha}", flush=True)
    seg = VistasSegmenter(model_dir, device, args.long_side, args.tile_long,
                          args.tile_overlap)

    records, per_strip = [], {}
    for jpg in jpgs:
        meta = manifest["byFile"].get(jpg.name, {})
        mask_name = jpg.stem + ".mask.png"
        mask_path = masks_dir / mask_name
        t0 = time.perf_counter()
        rgb = np.array(Image.open(jpg).convert("RGB"))
        mask, n_tiles = seg.segment(rgb)
        Image.fromarray(mask).save(mask_path)
        secs = time.perf_counter() - t0
        per_strip[jpg.stem] = round(secs, 4)
        rec = {
            "file": jpg.name, "stem": jpg.stem, "mask": str(mask_path.relative_to(out_dir)),
            "maskSha256": sha256_file(mask_path), "width": int(rgb.shape[1]),
            "height": int(rgb.shape[0]), "tiles": n_tiles,
            "seconds": round(secs, 4), "classShare": class_share(mask),
            "pandId": meta.get("pandId"), "address": meta.get("address"),
            "obliquityDeg": meta.get("obliquityDeg"),
            "standoffM": meta.get("standoffM"),
            "sourcePixelsPerMetre": meta.get("sourcePixelsPerMetre"),
            "renderedPixelsPerMetre": meta.get("renderedPixelsPerMetre"),
        }
        records.append(rec)
        print(f"  {jpg.name} {n_tiles} tile(s) {secs:.2f}s", flush=True)

    secs_list = list(per_strip.values())
    provenance = {
        "schemaVersion": 1,
        "task": "roofline-A1",
        "method": "s1",
        "stripsDir": str(strips_dir),
        "sourceManifestSha256": manifest["sha256"],
        "model": {
            "id": MODEL_ID, "revision": MODEL_REVISION,
            "weightsFile": WEIGHTS_FILE, "weightsSha256": weights_sha,
            "configSha256": sha256_file(model_dir / "config.json"),
            "preprocessorSha256": sha256_file(model_dir / "preprocessor_config.json"),
            "numLabels": 65, "device": device,
            "torch": torch.__version__, "transformers": transformers.__version__,
            "execution": "local MPS/CPU; no hosted inference",
        },
        "tiling": {
            "longSide": args.long_side, "tileLong": args.tile_long,
            "overlapPx": args.tile_overlap, "padMultiple": 32,
            "resize": "bilinear", "pad": "edge", "stitch": "first-write-wins",
        },
        "classMapping": {
            "contract": {str(k): v for k, v in sorted(CONTRACT_NAMES.items())},
            "vistasIdToContract": {str(k): v for k, v in sorted(VISTAS_TO_CONTRACT.items())},
            "ignoreIndex": VISTAS_IGNORE_INDEX,
            "notes": ("Vistas has no wire class, so wires are not mapped to occluder; "
                      "they fall through to whatever the model predicts (often sky or "
                      "building). Vegetation, pole, traffic sign/(light), vehicle, "
                      "person and riders map to 3. Building and Wall map to 2."),
        },
        "seconds": {
            "total": round(sum(secs_list), 3),
            "meanPerStrip": round(float(np.mean(secs_list)), 4) if secs_list else None,
            "medianPerStrip": round(float(np.median(secs_list)), 4) if secs_list else None,
            "perStrip": per_strip,
            "note": "wall-clock inference per strip on this machine, model resident",
        },
        "count": len(records),
        "records": records,
    }
    (out_dir / "s1.provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"wrote {out_dir / 's1.provenance.json'}", flush=True)


def run_af2(args) -> None:
    strips_dir = args.strips
    out_dir = args.out
    masks_dir = out_dir / "masks" / "af2"
    masks_dir.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(strips_dir)
    strip_stems = {p.stem for p in strips_dir.iterdir()
                   if p.suffix.lower() in (".jpg", ".jpeg", ".png")
                   and not p.name.endswith(".mask.png")}
    lut = contract_lut(AF2_TO_CONTRACT, ignore_index=255)

    records = []
    per_strip = {}
    for af2_dir in args.af2_dir:
        af2_dir = Path(af2_dir)
        for source in sorted(af2_dir.glob("*.mask.png")):
            stem = source.name[: -len(".mask.png")]
            arr = np.array(Image.open(source).convert("L"))
            if arr.max() > 4:
                raise SystemExit(f"{source}: values {np.unique(arr)} outside the "
                                 "amsterdam-facade/2 class order "
                                 f"{AF2_CLASS_ORDER}; stop and report.")
            t0 = time.perf_counter()
            mask = lut[arr]
            mask_path = masks_dir / f"{stem}.mask.png"
            Image.fromarray(mask).save(mask_path)
            secs = time.perf_counter() - t0
            per_strip[stem] = round(secs, 5)
            meta = manifest["byFile"].get(f"{stem}.jpg", {})
            records.append({
                "stem": stem, "sourceMask": str(source), "sourceMaskSha256": sha256_file(source),
                "mask": str(mask_path.relative_to(out_dir)), "maskSha256": sha256_file(mask_path),
                "width": int(mask.shape[1]), "height": int(mask.shape[0]),
                "seconds": round(secs, 5), "classShare": class_share(mask),
                "matchesStrip": f"{stem}.jpg" in manifest["byFile"],
                "pandId": meta.get("pandId"), "address": meta.get("address"),
                "obliquityDeg": meta.get("obliquityDeg"),
            })
            print(f"  {source.name} -> {mask_path.name}", flush=True)

    provenance = {
        "schemaVersion": 1, "task": "roofline-A1", "method": "af2",
        "stripsDir": str(strips_dir),
        "af2Dirs": [str(Path(d)) for d in args.af2_dir],
        "sourceManifestSha256": manifest["sha256"],
        "model": {
            "id": "amsterdam-facade/2",
            "classes": AF2_CLASS_ORDER,
            "note": ("Converted from existing Roboflow amsterdam-facade/2 masks; the "
                     "model is NOT re-run (its local weights are gone, pending the "
                     "owner's ROBOFLOW_API_KEY)."),
        },
        "conversion": {
            "af2ClassOrder": AF2_CLASS_ORDER,
            "af2IdToContract": {str(k): v for k, v in sorted(AF2_TO_CONTRACT.items())},
            "contract": {str(k): v for k, v in sorted(CONTRACT_NAMES.items())},
        },
        "seconds": {
            "total": round(sum(per_strip.values()), 5),
            "meanPerStrip": round(float(np.mean(list(per_strip.values()))), 5) if per_strip else None,
            "perStrip": per_strip,
            "note": "conversion only, no inference",
        },
        "count": len(records), "records": records,
    }
    (out_dir / "af2.provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"wrote {out_dir / 'af2.provenance.json'}", flush=True)


def main() -> None:
    default_cache = os.environ.get(
        "ROOFLINE_CACHE",
        "/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache")
    default_strips = ("/Users/blackmad/Code/map-recall2/.worktrees/"
                      "amsterdam-building-twin/.cache/facade-twin/strips-confident")
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--method", choices=["s1", "af2"], default="s1")
    ap.add_argument("--strips", type=Path, default=Path(default_strips),
                    help="Directory with *.jpg strips and manifest.json (per-strip obliquity).")
    ap.add_argument("--out", type=Path, default=Path(default_cache) / "roofline-eval")
    ap.add_argument("--model-dir", type=Path,
                    default=Path(default_cache) / "roofline-eval" / "models" / MODEL_ID.split("/")[-1])
    ap.add_argument("--af2-dir", type=Path, action="append", default=[],
                    help="Directory of amsterdam-facade/2 *.mask.png (repeatable; --method=af2).")
    ap.add_argument("--device", default="auto", help="auto|mps|cpu")
    ap.add_argument("--long-side", type=int, default=1024,
                    help="Model input long side in px; tiles are never squashed below this.")
    ap.add_argument("--tile-long", type=int, default=1024,
                    help="Source tile long side in px.")
    ap.add_argument("--tile-overlap", type=int, default=128)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.method == "s1":
        run_s1(args)
    else:
        if not args.af2_dir:
            ap.error("--method=af2 requires at least one --af2-dir")
        run_af2(args)


if __name__ == "__main__":
    main()
