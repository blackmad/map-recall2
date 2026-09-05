"""
Two photographs of one wall must agree. Measure how far off they are.

This is a correspondence test that uses no model and no labels, only the
project's own data and the one fact that makes rectification meaningful: if a
wall plane is where we think it is, then rectifying it from two different
panoramas — different day, different place on the quay — produces two pictures
of *the same wall at the same scale*. Slide one over the other and they lock.

If the plane is wrong, they do not lock, and the offset at which they best
agree is the registration error in metres. That number has never existed in
this project. `check-facade-registration.ts` has been red since it was written
and was unwired from the gate; it tried to correlate roofline steps against BAG
party-wall vertices, which is indirect and noisy. This is direct.

Why not a segmentation model: it was tried first and it fails on this input. On
a building whose projection is provably correct, the Amsterdam façade model
called the wall region 3.8% building while calling the rest of the frame 28.6%
— these dark winter crops are outside its training distribution, so "is there a
building here" came back "no" for 92% of buildings whose boxes are visibly on
buildings. A metric that wrong is worse than none. Normalised cross-correlation
has no opinion about Amsterdam.

What the numbers mean:
  - `peak` — how strongly the two views agree at their best alignment. Near 1 is
    the same wall photographed twice; near 0 is two different things.
  - `shiftM` — how far apart they had to be slid to agree, in metres along the
    wall and vertically. This is the registration residual.
  - A pair that agrees strongly at a large shift is a *consistent* error: the
    geometry is self-consistent but aimed at the wrong place.

Usage:
  python cross_view.py --index <multi-view.json> --strips <dir> --out <json>
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

import numpy as np
from PIL import Image

# Below this the two views are not the same surface at all.
LOCK = 0.35
# A shift this large is a real registration error rather than jitter.
BIG_SHIFT_M = 0.6


def prepare(path: Path, target_w: int, target_h: int) -> np.ndarray | None:
    """Grayscale, resized to a common frame, high-pass, and normalised.

    High-pass because the two panoramas were taken in different light and on
    different days: absolute brightness carries no correspondence information
    and a lot of nuisance. Edges — window heads, sills, storey bands, the bond —
    are what actually identify a wall.
    """
    try:
        im = Image.open(path).convert("L").resize((target_w, target_h), Image.LANCZOS)
    except Exception:
        return None
    a = np.asarray(im, dtype=np.float32)
    # Subtract a coarse blur: a cheap high-pass with no filter dependency. The
    # two panoramas were taken in different light on different days, so absolute
    # brightness carries no correspondence and a lot of nuisance; edges — window
    # heads, sills, storey bands — are what identify a wall.
    k = max(3, (min(target_w, target_h) // 12) | 1)
    pad = np.pad(a, k // 2, mode="edge")
    box = np.cumsum(np.cumsum(pad, 0, dtype=np.float64), 1)
    box = np.pad(box, ((1, 0), (1, 0)))          # integral image needs a zero row/col
    h, w = a.shape
    ys = np.arange(h)[:, None]; xs = np.arange(w)[None, :]
    blur = (box[ys + k, xs + k] - box[ys, xs + k] - box[ys + k, xs] + box[ys, xs]) / (k * k)
    a = a - blur.astype(np.float32)
    a -= a.mean()
    s = a.std()
    return a / s if s > 1e-6 else None


def correlate(a: np.ndarray, b: np.ndarray, max_shift: int):
    """Normalised cross-correlation by FFT; returns peak and its (dy, dx)."""
    fa = np.fft.rfft2(a)
    fb = np.fft.rfft2(b)
    c = np.fft.irfft2(fa * np.conj(fb), s=a.shape) / a.size
    c = np.fft.fftshift(c)
    cy, cx = a.shape[0] // 2, a.shape[1] // 2
    y0, y1 = max(0, cy - max_shift), min(a.shape[0], cy + max_shift + 1)
    x0, x1 = max(0, cx - max_shift), min(a.shape[1], cx + max_shift + 1)
    window = c[y0:y1, x0:x1]
    idx = int(np.argmax(window))
    dy, dx = np.unravel_index(idx, window.shape)
    return float(window.max()), int(dy + y0 - cy), int(dx + x0 - cx)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", required=True)
    ap.add_argument("--strips", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    index = json.loads(Path(args.index).read_text())["facades"]
    root = Path(args.strips)
    ids = sorted(index)
    if args.limit:
        ids = ids[:: max(1, len(ids) // args.limit)][: args.limit]

    results, done = {}, 0
    for pid in ids:
        views = index[pid]
        if len(views) < 2:
            continue
        # A common frame: one strip's own aspect, sized so a pixel is a few
        # centimetres and the correlation is cheap.
        wall_m = None
        first = root / views[0]["file"]
        if not first.exists():
            continue
        w0, h0 = Image.open(first).size
        tw = min(360, w0)
        th = max(8, int(round(h0 * tw / w0)))
        ppm = views[0]["pixelsPerMetre"] * tw / w0

        prepared = []
        for v in views:
            p = root / v["file"]
            if not p.exists():
                continue
            a = prepare(p, tw, th)
            if a is not None:
                prepared.append((v, a))
        if len(prepared) < 2:
            continue

        pairs = []
        max_shift = int(min(tw, th) * 0.28)
        for i in range(len(prepared)):
            for j in range(i + 1, len(prepared)):
                (vi, ai), (vj, aj) = prepared[i], prepared[j]
                peak, dy, dx = correlate(ai, aj, max_shift)
                pairs.append({
                    "a": vi["panoramaId"], "b": vj["panoramaId"],
                    "capturedA": vi["capturedAt"], "capturedB": vj["capturedAt"],
                    "peak": round(peak, 3),
                    "shiftAlongM": round(dx / ppm, 2),
                    "shiftUpM": round(dy / ppm, 2),
                    "shiftM": round(float(np.hypot(dx, dy)) / ppm, 2),
                })
        if not pairs:
            continue
        best = max(pairs, key=lambda p: p["peak"])
        peaks = sorted(p["peak"] for p in pairs)
        shifts = sorted(p["shiftM"] for p in pairs)
        median_peak = peaks[len(peaks) // 2]
        median_shift = shifts[len(shifts) // 2]

        if median_peak < LOCK:
            verdict, why = "no lock", "views do not agree they are the same wall"
        elif median_shift > BIG_SHIFT_M:
            verdict, why = "offset", f"views agree but are {median_shift:.2f} m apart"
        else:
            verdict, why = "locked", "independent views agree on the same wall"

        results[pid] = {
            "pandId": pid, "views": len(prepared), "verdict": verdict, "why": why,
            "medianPeak": round(median_peak, 3), "bestPeak": best["peak"],
            "medianShiftM": median_shift, "pairs": pairs,
        }
        done += 1
        sys.stdout.write({"locked": "#", "offset": "~", "no lock": "-"}[verdict])
        sys.stdout.flush()
        if done % 60 == 0:
            sys.stdout.write(f" {done}\n")
    print()

    Path(args.out).write_text(json.dumps({
        "metadata": {
            "generator": "scripts/facade-twin/vision/cross_view.py",
            "note": "Model-free correspondence test. Two panoramas rectified onto the same wall "
                    "plane must produce the same picture; the offset at best agreement is the "
                    "registration error in metres.",
            "lockThreshold": LOCK, "bigShiftM": BIG_SHIFT_M, "buildings": len(results),
        },
        "buildings": results,
    }, indent=1))

    from collections import Counter
    tally = Counter(v["verdict"] for v in results.values())
    n = max(len(results), 1)
    print(f"{len(results)} buildings with 2+ views\n")
    for k in ("locked", "offset", "no lock"):
        print(f"  {k:<9} {tally[k]:>4}  ({100*tally[k]//n}%)")
    if results:
        sh = sorted(v["medianShiftM"] for v in results.values() if v["verdict"] != "no lock")
        if sh:
            print(f"\n  registration residual among views that lock:")
            print(f"    median {sh[len(sh)//2]:.2f} m   p90 {sh[int(len(sh)*0.9)]:.2f} m   "
                  f"under 0.5 m: {sum(1 for x in sh if x < 0.5)}/{len(sh)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
