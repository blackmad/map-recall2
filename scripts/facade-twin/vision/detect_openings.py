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
from PIL import Image, ImageDraw
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
    """
    Infer from the path, not from a numpy array.

    `inference` follows the OpenCV convention and reads arrays as **BGR**.
    Handing it `np.array(Image.open(p).convert("RGB"))` therefore swaps red and
    blue before the model sees anything: brick goes blue, sky goes orange, and
    the model — reasonably — reports a brick wall as 92% sky. That is what it
    did, across all 1,723 strips, and it looked like a model that could not
    handle our imagery rather than a two-character mistake. On one strip the
    building share went from 9% to 58% on this change alone.
    """
    try:
        result = model.infer(str(path))
        result = result[0] if isinstance(result, list) else result
        return result.model_dump()["predictions"]
    except Exception:
        return None


def _bands(profile: np.ndarray, min_run: int, floor: float):
    """Runs where a 1-D profile stays above a threshold. Rows or columns."""
    if profile.size == 0:
        return []
    threshold = max(floor, profile.max() * 0.28)
    on = profile > threshold
    runs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_run:
                runs.append((start, i))
            start = None
    if start is not None and len(on) - start >= min_run:
        runs.append((start, len(on)))
    return runs


def instances(mask: np.ndarray, class_id: int, ppm: float, height_px: int, base_m: float):
    """
    Windows, as a grid rather than as connected components.

    Connected components were the obvious thing and they were wrong. A real
    window is cut into slivers by its own glazing bars and mullions, so the
    mask for one window arrives as five or ten ragged fragments; a solidity
    filter strict enough to reject a tree also rejects every sash window in
    Amsterdam. One strip came back with a single window found where the model
    had plainly painted eight.

    What the model is good at is saying *this pixel looks like glazing*. What it
    is not good at is grouping those pixels into openings. Façades are the easy
    case for that, because they are grids: windows line up in vertical bays and
    horizontal storeys, and that regularity is far stronger evidence than the
    connectivity of any one blob.

    So the window mask is projected onto each axis, the runs in those profiles
    give the bays and the storeys, and each cell of the resulting grid becomes
    one opening if enough of it is glazing. Fragments merge because they share a
    cell; noise disappears because a speck occupies no cell on its own.
    """
    binary = (mask == class_id)
    if not binary.any():
        return []
    h, w = binary.shape

    # Bays from the column profile, storeys from the row profile. The minimum
    # run lengths are the smallest real window in the grammar, in pixels.
    cols = binary.sum(axis=0).astype(np.float32)
    rows = binary.sum(axis=1).astype(np.float32)
    bays = _bands(cols, max(3, int(MIN_W_M * ppm * 0.7)), h * 0.02)
    storeys = _bands(rows, max(3, int(MIN_H_M * ppm * 0.7)), w * 0.02)
    if not bays or not storeys:
        return []

    out = []
    for x0, x1 in bays:
        for y0, y1 in storeys:
            cell = binary[y0:y1, x0:x1]
            if cell.size == 0:
                continue
            # Enough of the cell has to be glazing for it to be an opening at
            # all. Low, because bars and reflections eat into it.
            if cell.mean() < 0.22:
                continue
            # Tighten to the glazing actually present in the cell, so the box is
            # the window rather than the grid line it was found by.
            ys, xs = np.nonzero(cell)
            gx0, gx1 = x0 + int(xs.min()), x0 + int(xs.max()) + 1
            gy0, gy1 = y0 + int(ys.min()), y0 + int(ys.max()) + 1
            w_m, h_m = (gx1 - gx0) / ppm, (gy1 - gy0) / ppm
            if w_m < MIN_W_M or h_m < MIN_H_M:
                continue
            if min(w_m / h_m, h_m / w_m) < MIN_ASPECT:
                continue
            out.append({
                "xM": round(gx0 / ppm, 2),
                "yM": round((height_px - gy1) / ppm - base_m, 2),
                "widthM": round(w_m, 2),
                "heightM": round(h_m, 2),
                "fill": round(float(cell.mean()), 2),
            })
    return out


# Class colours for the debug overlay. Chosen so the two that decide whether a
# strip is usable at all — building and sky — are the two that read first.
OVERLAY = {
    "building": (255, 150, 60),
    "sky": (90, 170, 255),
    "window": (40, 230, 120),
    "door": (255, 190, 0),
    "background": (200, 60, 200),
}


def write_overlay(path: Path, mask: np.ndarray, cmap: dict, share: dict,
                  windows: list, doors: list, ppm: float, base_m: float, out_dir: Path) -> None:
    """
    Write the segmentation over the photograph it came from.

    The whole reason this pipeline shipped a 180° error is that nobody looked at
    the strips, so the debugging surface matters as much as the measurement. One
    JPEG per building: the photograph, the model's classes tinted over it, and
    the rectangles that were pulled out of the mask. If the tint is over a
    street rather than a wall, that is visible in the thumbnail without opening
    anything.
    """
    base = np.array(Image.open(path).convert("RGB")).astype(np.float32)
    h, w = mask.shape
    if base.shape[:2] != (h, w):
        base = np.array(Image.open(path).convert("RGB").resize((w, h))).astype(np.float32)
    tint = np.zeros_like(base)
    for cid, name in cmap.items():
        colour = OVERLAY.get(name)
        if not colour:
            continue
        tint[mask == cid] = colour
    blend = np.clip(base * 0.62 + tint * 0.38, 0, 255).astype(np.uint8)
    img = Image.fromarray(blend)
    draw = ImageDraw.Draw(img)
    for boxes, colour in ((windows, (40, 255, 130)), (doors, (255, 200, 0))):
        for b in boxes:
            x0 = b["xM"] * ppm
            y1 = h - (b["yM"] + base_m) * ppm
            draw.rectangle([x0, y1 - b["heightM"] * ppm, x0 + b["widthM"] * ppm, y1],
                           outline=colour, width=3)
    # A header strip carrying the numbers that decide whether to trust this.
    verdict = "USABLE" if share.get("building", 0) >= 45 else "REJECTED"
    bar = Image.new("RGB", (w, 26), (16, 20, 22))
    ImageDraw.Draw(bar).text(
        (6, 7),
        f"{path.stem[-6:]}  {verdict}  building {share.get('building',0):.0f}%  "
        f"sky {share.get('sky',0):.0f}%  windows {len(windows)}  doors {len(doors)}",
        fill=(120, 255, 170) if verdict == "USABLE" else (255, 120, 120))
    sheet = Image.new("RGB", (w, h + 26))
    sheet.paste(bar, (0, 0))
    sheet.paste(img, (0, 26))
    sheet.save(out_dir / f"{path.stem}.jpg", quality=82)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strips", required=True)
    ap.add_argument("--meta", required=True, help="facade-evidence.json, for pixels-per-metre")
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--ids", default="")
    ap.add_argument("--base", type=float, default=1.8, help="strip base, metres below ground")
    ap.add_argument("--overlays", default="", help="directory for one debug JPEG per building")
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

    overlays = Path(args.overlays) if args.overlays else None
    if overlays:
        overlays.mkdir(parents=True, exist_ok=True)

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
        if overlays:
            write_overlay(path, mask, cmap, share, out[pid]["windows"], out[pid]["doors"],
                          ppm, args.base, overlays)
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
