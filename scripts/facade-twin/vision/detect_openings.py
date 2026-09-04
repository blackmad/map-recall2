"""
Find openings in a rectified façade with a segmentation model trained on Amsterdam.

Replaces a hand-rolled detector that had no concept of a window. That one scored
any region deviating from its local wall — in either direction, because glass
reads dark when it shows a room and bright when it reflects sky — which meant
bright sky between bare branches scored exactly as strongly as a window. It
boxed trees. It boxed the gaps in a bridge railing. It could not do otherwise:
nothing in it knew what a window was.

This does. `cmp-zosci/amsterdam-facade` is a semantic segmentation model over
909 Amsterdam façades with 7,245 labelled windows and 1,048 doors, and — the
part that matters as much as the windows — a `sky` class and a `building`
class. So the same pass that finds the openings also measures how much of the
frame is actually building, which is the quality gate this pipeline never had:
a rectified strip that is 60% sky was pointed at nothing, and no amount of
careful measurement of it is worth anything.

Output is in metres on the wall, using the strip's own pixels-per-metre, so it
drops into the same place the old detector's readings did.

Usage:
  python detect_openings.py --strips <dir> --out <json> [--limit N] [--ids a,b]
"""
from __future__ import annotations
import argparse, base64, io, json, os, sys, warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np
from PIL import Image
from scipy import ndimage

MODEL = "amsterdam-facade/2"

# A window smaller than this is either a fanlight fragment or mask noise. Set in
# metres rather than pixels because strips are rendered at different resolutions
# depending on how far away the camera stood.
MIN_W_M, MIN_H_M = 0.35, 0.45
# Instances thinner than this are almost always a glazing bar splitting one
# window into slivers, not two windows.
MIN_ASPECT = 0.12


def load_model():
    """
    Load the weights locally rather than calling the hosted endpoint.

    `get_model` fetches the ONNX weights once — 17.5 MB — caches them, and then
    runs on-device through CoreML on Apple Silicon. That matters for more than
    speed: a thousand-image run over a hosted API is rate-limited, costs money,
    needs a key present at run time, and makes the extraction unreproducible by
    anyone who does not have one. Offline weights make the whole pass a local
    computation, which is what the rest of this pipeline already is.

    An API key is still needed the first time, to fetch the weights.
    """
    from inference import get_model
    return get_model(model_id=MODEL)


def segment(model, path: Path) -> dict | None:
    try:
        image = np.array(Image.open(path).convert("RGB"))
        result = model.infer(image)
        result = result[0] if isinstance(result, list) else result
        return result.model_dump()["predictions"]
    except Exception:
        return None


def instances(mask: np.ndarray, class_id: int, ppm: float, height_px: int, base_m: float):
    """Connected components of one class, as rectangles in metres on the wall."""
    labelled, _ = ndimage.label(mask == class_id)
    out = []
    for sl in ndimage.find_objects(labelled):
        if sl is None:
            continue
        y0, y1 = sl[0].start, sl[0].stop
        x0, x1 = sl[1].start, sl[1].stop
        w_m, h_m = (x1 - x0) / ppm, (y1 - y0) / ppm
        if w_m < MIN_W_M or h_m < MIN_H_M:
            continue
        if min(w_m / h_m, h_m / w_m) < MIN_ASPECT:
            continue
        # How solid is the component? A ragged mask over a tree is not a window.
        fill = float((labelled[sl] > 0).sum()) / max((y1 - y0) * (x1 - x0), 1)
        if fill < 0.55:
            continue
        # The strip runs from base_m below ground at its bottom edge.
        out.append({
            "xM": round(x0 / ppm, 2),
            "yM": round((height_px - y1) / ppm - base_m, 2),
            "widthM": round(w_m, 2),
            "heightM": round(h_m, 2),
            "fill": round(fill, 2),
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strips", required=True)
    ap.add_argument("--meta", required=True, help="facade-evidence.json, for pixels-per-metre")
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--ids", default="")
    ap.add_argument("--base", type=float, default=1.8, help="strip base, metres below ground")
    args = ap.parse_args()

    if not os.environ.get("ROBOFLOW_API_KEY"):
        print("ROBOFLOW_API_KEY not set (needed once, to fetch the weights)", file=sys.stderr)
        return 2
    model = load_model()

    meta = json.loads(Path(args.meta).read_text())
    by_id = {f["pandId"]: f for f in meta["facades"]}
    strips = Path(args.strips)

    wanted = [i for i in args.ids.split(",") if i]
    ids = wanted or sorted(p.stem for p in strips.glob("*.jpg"))
    if args.limit:
        step = max(1, len(ids) // args.limit)
        ids = ids[::step][: args.limit]

    out, done, failed = {}, 0, 0
    for pid in ids:
        path = strips / f"{pid}.jpg"
        if not path.exists() or pid not in by_id:
            continue
        preds = segment(model, path)
        if not preds:
            failed += 1
            continue
        cmap = {int(k): v for k, v in preds["class_map"].items()}
        mask = np.array(Image.open(io.BytesIO(base64.b64decode(preds["segmentation_mask"]))))
        if mask.ndim == 3:
            mask = mask[:, :, 0]
        h, w = mask.shape
        total = h * w
        share = {name: round(100 * float((mask == cid).sum()) / total, 1)
                 for cid, name in cmap.items()}
        # The strip was rendered at this many pixels per metre of wall.
        ppm = w / max(by_id[pid]["wallWidthM"], 0.1)
        ids_by_name = {v: k for k, v in cmap.items()}
        out[pid] = {
            "pandId": pid,
            "share": share,
            "pixelsPerMetre": round(ppm, 1),
            "windows": instances(mask, ids_by_name.get("window", -1), ppm, h, args.base),
            "doors": instances(mask, ids_by_name.get("door", -1), ppm, h, args.base),
        }
        done += 1
        sys.stdout.write("#" if share.get("building", 0) >= 45 else "-")
        sys.stdout.flush()
        if done % 50 == 0:
            sys.stdout.write(f" {done}\n")
    print()

    Path(args.out).write_text(json.dumps({
        "metadata": {
            "model": MODEL,
            "generator": "scripts/facade-twin/vision/detect_openings.py",
            "note": "Semantic segmentation over rectified strips. `share` is the percentage of "
                    "the frame each class covers; a low `building` share means the rectifier was "
                    "pointed at something that is not this building's front.",
            "judged": done, "failed": failed,
            "stripBaseBelowGroundM": args.base,
        },
        "facades": out,
    }, indent=1))

    if out:
        shares = sorted(v["share"].get("building", 0) for v in out.values())
        good = [v for v in out.values() if v["share"].get("building", 0) >= 45]
        print(f"{done} strips segmented, {failed} failed")
        print(f"  building share  p10 {shares[len(shares)//10]:.0f}%  "
              f"p50 {shares[len(shares)//2]:.0f}%  p90 {shares[9*len(shares)//10]:.0f}%")
        print(f"  usable (>=45% building): {len(good)} ({100*len(good)//max(done,1)}%)")
        wins = [len(v["windows"]) for v in good]
        if wins:
            wins.sort()
            print(f"  windows per usable strip: median {wins[len(wins)//2]}, total {sum(wins)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
