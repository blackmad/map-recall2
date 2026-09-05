"""
Does a building actually stand where we projected one?

This is the check the project never had, and every failure of the last two days
came from its absence. The pipeline's first act is a correspondence — *this*
BAG footprint appears at *these* pixels of *that* panorama — and it was only
ever tested through its own consequences: does the rectified strip look like a
façade? In Amsterdam that question has no power, because whatever you point at
looks like a façade. A 180 degree yaw error passed it for the whole project.

So the test is made direct and automatic:

  1. `project-check.ts` draws each BAG footprint into the raw panorama and
     records the pixel box it lands in. No rectification is involved, so this
     tests the transform, the camera model, the pose and the wall choice
     together — which is right, because a rectified strip cannot separate them.
  2. Here, the segmentation model is asked what is inside that box. A building
     that is really there fills its own box; a box over a road, a canal or the
     sky does not.
  3. And because the same footprint is projected into several panoramas taken
     from different places on different days, the views can be made to agree or
     disagree. Two cameras cannot both put a building where there is none, and
     when they disagree the geometry is wrong in a way no single view reveals.

The output is a per-building verdict with a reason, which is what an automated
loop needs: something to sort by, not a number to feel good about.

Usage:
  python correspondence.py --projections <json> --crops <dir> --out <json>
"""
from __future__ import annotations
import argparse, base64, io, json, os, sys, warnings
from collections import defaultdict
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np
from PIL import Image

MODEL = "amsterdam-facade/2"
# A projected box should be mostly building. Below this it is over something
# else — road, water, sky, a neighbour's flank.
GOOD_FILL = 0.55
POOR_FILL = 0.25


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--projections", required=True)
    ap.add_argument("--crops", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    if not os.environ.get("ROBOFLOW_API_KEY"):
        print("ROBOFLOW_API_KEY not set", file=sys.stderr); return 2

    from inference import get_model
    model = get_model(model_id=MODEL)

    rows = json.loads(Path(args.projections).read_text())["buildings"]
    crops = Path(args.crops)
    per_view, done = [], 0
    for r in rows:
        path = crops / r["file"]
        if not path.exists():
            continue
        try:
            res = model.infer(str(path))
            res = res[0] if isinstance(res, list) else res
            preds = res.model_dump()["predictions"]
        except Exception:
            continue
        cmap = {int(k): v for k, v in preds["class_map"].items()}
        mask = np.array(Image.open(io.BytesIO(base64.b64decode(preds["segmentation_mask"]))))
        if mask.ndim == 3:
            mask = mask[:, :, 0]
        h, w = mask.shape
        # The mask may not come back at the crop's own size.
        cw, ch = (int(v) for v in r["crop"].split("x"))
        sx, sy = w / cw, h / ch
        if "wallQuad" not in r:
            continue
        ids = {v: k for k, v in cmap.items()}
        built_mask = np.isin(mask, [ids.get("building", -1), ids.get("window", -1),
                                    ids.get("door", -1)])
        # Fill is measured inside the wall quad, not its bounding box. A building
        # seen at an angle has a bounding box that is mostly sky and road even
        # when the projection is exact, so the box scores every building wrong.
        quad = np.array([[qx * sx, qy * sy] for qx, qy in r["wallQuad"]], dtype=np.float64)
        yy, xx = np.mgrid[0:h, 0:w]
        insideq = np.ones((h, w), bool)
        for i in range(4):
            ax, ay = quad[i]; bx, by = quad[(i + 1) % 4]
            insideq &= ((bx - ax) * (yy - ay) - (by - ay) * (xx - ax)) >= 0
        if not insideq.any():                       # wound the other way
            insideq = np.ones((h, w), bool)
            for i in range(4):
                ax, ay = quad[i]; bx, by = quad[(i + 1) % 4]
                insideq &= ((bx - ax) * (yy - ay) - (by - ay) * (xx - ax)) <= 0
        if insideq.sum() < 16:
            continue
        fill = float(built_mask[insideq].mean())
        # And what is in the rest of the frame, which says what we hit instead.
        elsewhere = {n: round(float((mask[~insideq] == c).mean()), 2) for c, n in cmap.items()}
        per_view.append({
            "pandId": r["buildingId"], "panoramaId": r["panoramaId"],
            "capturedAt": r.get("capturedAt"), "file": r["file"],
            "address": r.get("address"),
            "boxFill": round(fill, 3),
            "impliedPixelsPerMetre": r.get("impliedPixelsPerMetre"),
            "expectedPixelsPerMetre": r.get("expectedPixelsPerMetre"),
            "elsewhere": elsewhere,
        })
        done += 1
        sys.stdout.write("#" if fill >= GOOD_FILL else ("." if fill >= POOR_FILL else "-"))
        sys.stdout.flush()
        if done % 60 == 0:
            sys.stdout.write(f" {done}\n")
    print()

    by_building = defaultdict(list)
    for v in per_view:
        by_building[v["pandId"]].append(v)

    verdicts = {}
    for pid, views in by_building.items():
        fills = sorted(v["boxFill"] for v in views)
        best, worst = fills[-1], fills[0]
        median = fills[len(fills) // 2]
        # Scale sanity: the projected wall width in pixels should match what the
        # panorama gives at that range. A large mismatch means the geometry and
        # the camera model disagree about distance.
        scale_err = [abs(v["impliedPixelsPerMetre"] - v["expectedPixelsPerMetre"])
                     / max(v["expectedPixelsPerMetre"], 1)
                     for v in views if v.get("expectedPixelsPerMetre")]
        scale = max(scale_err) if scale_err else 0.0

        if best < POOR_FILL:
            verdict, why = "wrong", "no view finds a building in the projected box"
        elif median < POOR_FILL:
            verdict, why = "wrong", "most views find no building where one was projected"
        elif len(views) > 1 and best - worst > 0.45:
            verdict, why = "unstable", "views disagree about whether a building is there"
        elif scale > 0.35:
            verdict, why = "unstable", f"projected size is {scale:.0%} off what the range implies"
        elif median >= GOOD_FILL:
            verdict, why = "good", "every view puts a building in the box"
        else:
            verdict, why = "weak", "a building is there but does not fill the box"
        verdicts[pid] = {
            "pandId": pid, "verdict": verdict, "why": why, "views": len(views),
            "medianFill": round(median, 3), "bestFill": round(best, 3), "worstFill": round(worst, 3),
            "scaleError": round(scale, 3),
            "address": views[0].get("address"),
            "files": [v["file"] for v in views],
        }

    Path(args.out).write_text(json.dumps({
        "metadata": {"model": MODEL, "generator": "scripts/facade-twin/vision/correspondence.py",
                     "note": "Does a building stand where the footprint was projected? Tests the "
                             "coordinate transform, camera model, pose and wall choice together, "
                             "without rectification. Multiple views per building make agreement "
                             "measurable.",
                     "goodFill": GOOD_FILL, "poorFill": POOR_FILL,
                     "views": len(per_view), "buildings": len(verdicts)},
        "verdicts": verdicts, "views": per_view,
    }, indent=1))

    tally = defaultdict(int)
    for v in verdicts.values():
        tally[v["verdict"]] += 1
    n = max(len(verdicts), 1)
    print(f"{len(per_view)} views of {len(verdicts)} buildings\n")
    for k in ("good", "weak", "unstable", "wrong"):
        print(f"  {k:<9} {tally[k]:>4}  ({100*tally[k]//n}%)")
    multi = [v for v in verdicts.values() if v["views"] > 1]
    if multi:
        spread = sorted(v["bestFill"] - v["worstFill"] for v in multi)
        print(f"\n  {len(multi)} buildings with 2+ views; median disagreement between views "
              f"{spread[len(spread)//2]:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
