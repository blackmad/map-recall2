"""Run the Amsterdam-specific semantic-segmentation model and extract OUTLINES.

`cmp-zosci/amsterdam-facade/2` (Roboflow project "Amsterdam Facade", 909 images,
trained as DeepLabV3+) is the City of Amsterdam facade dataset lineage and is the
only Amsterdam-specific model we have. It is semantic segmentation, so its output
is a per-pixel class mask: window and door regions come back as **polygons that
follow the real outline**, not axis-aligned boxes.

Model id for the local `inference` package is `amsterdam-facade/2` — the package
accepts exactly `project/version`, so the workspace prefix is not allowed.

Classes: 0 background, 1 building, 2 door, 3 sky, 4 window.

Usage:
  python run_amsterdam_seg.py --manifest <evidence manifest> --setting R0 \
      --out <json> [--min-area-px 64] [--simplify-px 1.5] [--limit N]

Emits the same lane contract as the box models, plus a `polygon` per box: a list
of [along, up] wall-metre vertices following the mask contour. `along` is metres
from plane.start, `up` is metres above plane.baseZ.
"""
import argparse
import base64
import io
import json
import math
import os
import time

import cv2
import numpy as np
from PIL import Image

DEFAULT_KEY_FILE = "/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.env.local"
CLASS_DOOR = 2
CLASS_WINDOW = 4


def api_key(path):
    if os.environ.get("ROBOFLOW_API_KEY"):
        return os.environ["ROBOFLOW_API_KEY"]
    with open(path) as handle:
        for line in handle:
            if line.strip().startswith("ROBOFLOW_API_KEY"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("no ROBOFLOW_API_KEY in env or key file")


def plane_length(plane):
    return math.hypot(plane["end"]["x"] - plane["start"]["x"], plane["end"]["y"] - plane["start"]["y"])


def contours_for(mask, class_id, min_area_px, simplify_px):
    """Connected components of one class, as polygons in crop pixels."""
    binary = (mask == class_id).astype(np.uint8)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area_px:
            continue
        approx = cv2.approxPolyDP(contour, simplify_px, True).reshape(-1, 2)
        if len(approx) < 3:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        out.append({"areaPx": float(area), "bboxPx": (float(x), float(y), float(w), float(h)), "polygonPx": approx.tolist()})
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", action="append", required=True)
    parser.add_argument("--setting", choices=["R0", "R1"], default="R0")
    parser.add_argument("--out", required=True)
    parser.add_argument("--model-id", default="amsterdam-facade/2")
    parser.add_argument("--min-area-px", type=float, default=64.0)
    parser.add_argument("--simplify-px", type=float, default=1.5)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--key-file", default=DEFAULT_KEY_FILE)
    args = parser.parse_args()

    from inference import get_model

    model = get_model(model_id=args.model_id, api_key=api_key(args.key_file))
    records, errors = [], []
    started = time.time()
    crops_run = 0
    counts = {"window": 0, "door": 0}
    for manifest_path in args.manifest:
        manifest = json.load(open(manifest_path))
        images_dir = os.path.join(os.path.dirname(os.path.abspath(manifest_path)), "images")
        for record in manifest.get("records", []):
            if args.limit and crops_run >= args.limit:
                break
            full = (record.get("images") or {}).get("full")
            if not full:
                continue
            crop_path = os.path.join(images_dir, full["file"])
            plane = full["plane"]
            wall_width = plane_length(plane)
            wall_height = plane["topZ"] - plane["baseZ"]
            width_px, height_px = full.get("width"), full.get("height")
            entry = {
                "buildingId": record.get("buildingId"),
                "elevationId": record.get("elevationId"),
                "surfaceId": record.get("id") or record.get("elevationId"),
                "wallWidthM": wall_width,
                "wallHeightM": wall_height,
                "cropFile": crop_path,
                "cropWidthPx": width_px,
                "cropHeightPx": height_px,
                "pixelsPerMetre": (width_px / wall_width) if wall_width else None,
                "tiles": 1,
                "boxes": [],
            }
            try:
                response = model.infer(crop_path)
                prediction = (response[0] if isinstance(response, list) else response).predictions
                payload = prediction.segmentation_mask.split(",", 1)[-1]
                mask = np.array(Image.open(io.BytesIO(base64.b64decode(payload))))
                if width_px is None or height_px is None:
                    height_px, width_px = mask.shape[0], mask.shape[1]
                    entry["cropWidthPx"], entry["cropHeightPx"] = width_px, height_px
                    entry["pixelsPerMetre"] = (width_px / wall_width) if wall_width else None
                sx = wall_width / width_px
                sy = wall_height / height_px
                for class_id, kind in ((CLASS_DOOR, "door"), (CLASS_WINDOW, "window")):
                    for found in contours_for(mask, class_id, args.min_area_px, args.simplify_px):
                        x, y, w, h = found["bboxPx"]
                        # pixel y grows downward; wall `up` grows upward from baseZ
                        along = x * sx
                        up = (height_px - (y + h)) * sy
                        polygon = [[round(px * sx, 4), round((height_px - py) * sy, 4)] for px, py in found["polygonPx"]]
                        entry["boxes"].append({
                            "kind": kind,
                            "score": None,
                            "along": round(along, 4),
                            "up": round(up, 4),
                            "widthM": round(w * sx, 4),
                            "heightM": round(h * sy, 4),
                            "areaM2": round(found["areaPx"] * sx * sy, 4),
                            "polygon": polygon,
                        })
                        counts[kind] += 1
                crops_run += 1
            except Exception as error:  # noqa: BLE001 - one bad crop must not stop the run
                entry["error"] = str(error)
                errors.append({"elevationId": entry["elevationId"], "error": str(error)})
            records.append(entry)
            print(f"[{crops_run}] {entry['elevationId']} boxes={len(entry['boxes'])}", flush=True)

    payload = {
        "schemaVersion": 1,
        "lane": "amsseg",
        "model": args.model_id,
        "setting": args.setting,
        "task": "semantic-segmentation",
        "boxConvention": "along = metres from plane.start; up = metres above plane.baseZ; polygon follows the mask contour",
        "classMap": {"0": "background", "1": "building", "2": "door", "3": "sky", "4": "window"},
        "totals": counts,
        "throughput": {"cropsRun": crops_run, "secondsTotal": round(time.time() - started, 1),
                       "secondsPerCrop": round((time.time() - started) / max(crops_run, 1), 3)},
        "errors": errors,
        "records": records,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as handle:
        json.dump(payload, handle)
    print(json.dumps({"out": args.out, "records": len(records), "totals": counts, "errors": len(errors)}))


if __name__ == "__main__":
    main()
