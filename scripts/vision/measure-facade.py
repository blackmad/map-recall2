# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "numpy", "opencv-python-headless", "scipy"]
# ///
"""PARKED SPIKE (docs/reports/vision-measure-20261110.md): classic-CV facade
measurement from a rectified crop. Bays are usable only as a cross-check;
storeys are not (41 % vs 85 % constant baseline). Not wired into any pipeline.

Usage: measure-facade.py [--ppm 40] [--debug DIR] IMAGE... > JSON
Output schema: see src/canalRecall/facade/visionMeasure.ts (version 1).
No model weights, no randomness: same bytes in, same JSON out.
"""
import argparse, json, math, os, sys, time
import numpy as np
import cv2
from PIL import Image
from scipy.signal import find_peaks
from scipy.ndimage import gaussian_filter1d

SCHEMA = 1


def hexc(rgb):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in rgb)


def wall_colour(rgb, lab, edge):
    """Median colour of the low-edge pixels in the middle of the crop."""
    h, w = edge.shape
    sl = (slice(int(h * 0.15), int(h * 0.85)), slice(int(w * 0.1), int(w * 0.9)))
    m = edge[sl] < np.percentile(edge[sl], 55)
    px = rgb[sl][m]
    return np.median(px, axis=0)


def smooth(v, s):
    return gaussian_filter1d(v.astype(np.float64), s, mode="nearest")


def runs_above(sig, thr, min_len):
    on = sig > thr
    out, i, n = [], 0, len(sig)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            if j - i >= min_len:
                out.append((i, j))
            i = j
        else:
            i += 1
    return out


def measure(path, ppm=40.0, debug=None, P=None):
    P = P or {}
    t0 = time.time()
    im = np.asarray(Image.open(path).convert("RGB"))
    H, W = im.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 1.0)
    gx = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0))
    gy = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1))
    edge = gx + gy
    wall = wall_colour(im, None, edge)
    out = dict(schema=SCHEMA, widthM=round(W / ppm, 2), heightM=round(H / ppm, 2), wall=hexc(wall))
    # ---- eaves: per-column first row from the top whose local texture is wall-like
    tex = cv2.blur(edge, (int(0.3 * ppm) | 1, int(0.3 * ppm) | 1))
    base = float(np.median(tex[int(H * 0.5):int(H * 0.9)]))
    thr = P.get("skyFrac", 0.5) * base
    firsts = []
    for x in range(0, W, 2):
        col = tex[:, x] > thr
        ys = np.nonzero(col)[0]
        # require a sustained run of 0.6 m so a branch or wire is not the wall
        y = H
        run = int(0.6 * ppm)
        c = np.convolve(col.astype(np.int32), np.ones(run, dtype=np.int32), mode="valid")
        hit = np.nonzero(c >= run * 0.9)[0]
        if len(hit):
            y = int(hit[0])
        firsts.append(y)
    eaves_y = int(np.percentile(firsts, P.get("eavesPct", 50)))
    out["eavesM"] = round((H - eaves_y) / ppm, 2)
    top = eaves_y
    # columns first: window columns carry the horizontal edges (heads, sills, bars)
    y0 = top + int(0.08 * (H - top))
    cols = smooth(gy[y0:int(H * 0.97)].mean(0), P.get("colSigma", 0.12) * ppm)
    clo, chi = cols.min(), cols.max()
    cpk, _ = find_peaks(cols, distance=int(P.get("minBayM", 0.9) * ppm), prominence=P.get("colProm", 0.18) * (chi - clo))
    colmask = cols > (clo + P.get("colMask", 0.45) * (chi - clo))
    if colmask.sum() < 0.15 * W:
        colmask[:] = True
    var = P.get("rowVar", "B")
    if var == "A":
        rsig = gx.mean(1)
    elif var == "B":
        rsig = gx[:, colmask].mean(1)
    elif var == "D":
        g2 = cv2.GaussianBlur(gray, (0, 0), P.get("dSigma", 2.0))
        loc = cv2.blur(g2, (int(2.0 * ppm) | 1, int(2.0 * ppm) | 1))
        dm = ((loc - g2) > P.get("dThr", 14)).astype(np.float32)
        rsig = dm[:, colmask].mean(1)
    else:
        rsig = gx[:, colmask].mean(1) * gy[:, colmask].mean(1)
    rows = smooth(rsig, P.get("rowSigma", 0.2) * ppm)
    seg = rows[top:]
    lo, hi = seg.min(), seg.max()
    pk, pr = find_peaks(seg, distance=int(P.get("minStoreyM", 2.2) * ppm), prominence=P.get("rowProm", 0.2) * (hi - lo))
    pk = pk + top
    out["_rowPeaks"] = [int(p) for p in pk]
    # chain from the ground upward while spacing stays storey-like
    chain = []
    for y in sorted(pk, reverse=True):
        if not chain:
            chain.append(y)
            continue
        gap = (chain[-1] - y) / ppm
        if gap > P.get("maxGapM", 4.6):
            break
        chain.append(y)
    byHeight = int(round((H - top) / ppm / P.get("upperM", 3.0) - P.get("offs", 0.6)))
    out["_byHeight"] = byHeight
    storeys = len(chain) if P.get("mode", "peaks") == "peaks" else byHeight
    out["bays"] = len(cpk)
    out["storeys"] = storeys
    out["ms"] = round((time.time() - t0) * 1000)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--ppm", type=float, default=40.0)
    ap.add_argument("--debug")
    a = ap.parse_args()
    res = []
    for p in a.images:
        o = measure(p, a.ppm)
        o["image"] = os.path.basename(p)
        res.append(o)
    json.dump(res, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
