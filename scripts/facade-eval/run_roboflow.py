"""Run any Roboflow façade model on rectified crops and emit boxes in wall metres.

A generic sibling of run_rfdetr.py so several models can be compared on the same
crops with one output contract. The crop is axis-aligned to the wall plane
(plane.start -> plane.end, baseZ -> topZ), so the pixel -> wall-metre mapping is
a plain scale.

Usage:
  python run_roboflow.py --model-id facade-rsjek/5 --manifest <evidence manifest> \
      --setting R0 --out <json> [--confidence 0.4] [--limit N]

Output: schemaVersion 1, lane = <model-id>, records[].boxes[] = {kind, score,
along, up, widthM, heightM} with `along` metres from plane.start and `up` metres
above plane.baseZ.
"""
import argparse
import json
import math
import os
import sys
import time

DEFAULT_KEY_FILE = "/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.env.local"

# model class name -> our kind
WINDOW_NAMES = {"window", "windows", "Window"}
DOOR_NAMES = {"door", "doors", "entrance", "Door", "Entrance"}


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--manifest", action="append", required=True)
    parser.add_argument("--setting", choices=["R0", "R1"], default="R0")
    parser.add_argument("--out", required=True)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--confidence", type=float, default=0.4)
    parser.add_argument("--key-file", default=DEFAULT_KEY_FILE)
    args = parser.parse_args()

    from inference import get_model
    from PIL import Image

    model = get_model(model_id=args.model_id, api_key=api_key(args.key_file))

    records_out = []
    errors = []
    started = time.time()
    crops_run = 0
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
            width_px = full.get("width") or Image.open(crop_path).size[0]
            height_px = full.get("height") or Image.open(crop_path).size[1]
            entry = {
                "buildingId": record.get("buildingId"),
                "elevationId": record.get("elevationId"),
                "surfaceId": record.get("id") or record.get("elevationId"),
                "wallWidthM": wall_width,
                "wallHeightM": wall_height,
                "cropFile": crop_path,
                "cropWidthPx": width_px,
                "cropHeightPx": height_px,
                "pixelsPerMetre": width_px / wall_width if wall_width else None,
                "tiles": 1,
                "boxes": [],
            }
            try:
                result = model.infer(crop_path, confidence=args.confidence)
                predictions = result[0].predictions if isinstance(result, list) else result.predictions
                for prediction in predictions:
                    klass = str(getattr(prediction, "class_name", "") or "")
                    kind = "window" if klass in WINDOW_NAMES else "door" if klass in DOOR_NAMES else "other"
                    x = float(prediction.x)
                    y = float(prediction.y)
                    w = float(prediction.width)
                    h = float(prediction.height)
                    entry["boxes"].append({
                        "kind": kind,
                        "score": float(prediction.confidence),
                        "along": (x - w / 2) / width_px * wall_width,
                        "up": (height_px - (y + h / 2)) / height_px * wall_height,
                        "widthM": w / width_px * wall_width,
                        "heightM": h / height_px * wall_height,
                        "modelClass": klass,
                    })
                crops_run += 1
            except Exception as error:  # noqa: BLE001 - one bad crop must not stop the run
                entry["error"] = str(error)
                errors.append({"elevationId": entry["elevationId"], "error": str(error)})
            records_out.append(entry)
            print(f"[{crops_run}] {entry['elevationId']} boxes={len(entry['boxes'])}", flush=True)

    payload = {
        "schemaVersion": 1,
        "lane": args.model_id.split("/")[0],
        "model": args.model_id,
        "setting": args.setting,
        "confidence": args.confidence,
        "boxConvention": "along = metres from plane.start; up = metres above plane.baseZ (min edge)",
        "throughput": {
            "cropsRun": crops_run,
            "secondsTotal": round(time.time() - started, 1),
            "secondsPerCrop": round((time.time() - started) / max(crops_run, 1), 3),
        },
        "errors": errors,
        "records": records_out,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as handle:
        json.dump(payload, handle, indent=1)
    print(json.dumps({"out": args.out, "records": len(records_out), "errors": len(errors),
                      "secondsPerCrop": payload["throughput"]["secondsPerCrop"]}))


if __name__ == "__main__":
    sys.exit(main())
