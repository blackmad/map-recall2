# /// script
# requires-python = "==3.11.*"
# dependencies = ["numpy==1.26.4", "trimesh==4.0.5", "Pillow==10.1.0"]
# ///
"""Which horizontal axis of a TRELLIS.2 mesh is the front of the first input photo.

    python -I orient_front.py <raw.ply> <v0-rgba.png> [--up=z]

A cross-check for TRELLIS.2 runs (rebuild.ts uses -y, which held for every run checked by eye); silhouettes alone cannot separate
front from back. Every candidate front (+x, -x, +y, -y, up z) is rendered as a point splat seen from that side (vertex
colours, nearest point per pixel), and compared with the cut-out: silhouette IoU plus the correlation of the grey levels inside
both silhouettes (the grey term is meant to separate front from back, whose silhouettes are mirror images, but on dark bronze it
was too weak: Vondel and Wilhelmina scored +y over the correct -y). Prints JSON with every score and
the best-scoring `front`, in the axis notation of decimate_scale_glb.py (image right = up x front, as there).
"""
import json
import sys

import numpy as np
import trimesh
from PIL import Image

args = dict((a[2:].split("=", 1) + ["1"])[:2] for a in sys.argv[3:] if a.startswith("--"))
mesh = trimesh.load(sys.argv[1], process=False)
v = np.asarray(mesh.vertices, dtype=np.float64)
col = np.asarray(mesh.visual.vertex_colors)[:, :3].astype(np.float64) @ [0.299, 0.587, 0.114]
if len(v) > 400_000:
    pick = np.random.default_rng(0).choice(len(v), 400_000, replace=False)
    v, col = v[pick], col[pick]
ax = {"x": 0, "y": 1, "z": 2}
U = np.zeros(3); U[ax[args.get("up", "z")]] = 1
N = 96

ref = np.asarray(Image.open(sys.argv[2]).convert("RGBA"))
a = ref[:, :, 3] > 127
ys, xs = np.nonzero(a)
crop = ref[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit(img_mask, img_grey):
    """Scale a (mask, grey) pair into an N x N frame keeping aspect, bottom-centred."""
    h, w = img_mask.shape
    s = (N - 4) / max(h, w)
    m = np.asarray(Image.fromarray((img_mask * 255).astype(np.uint8)).resize((max(1, int(w * s)), max(1, int(h * s))))) > 127
    g = np.asarray(Image.fromarray(img_grey.astype(np.uint8)).resize((m.shape[1], m.shape[0])), dtype=np.float64)
    M = np.zeros((N, N), bool); G = np.zeros((N, N))
    oy, ox = N - 2 - m.shape[0], (N - m.shape[1]) // 2
    M[oy:oy + m.shape[0], ox:ox + m.shape[1]] = m
    G[oy:oy + m.shape[0], ox:ox + m.shape[1]] = g
    return M, G


refM, refG = fit(crop[:, :, 3] > 127, crop[:, :, :3].astype(np.float64) @ [0.299, 0.587, 0.114])
scores = {}
for name in ("+x", "-x", "+y", "-y"):
    F = np.zeros(3); F[ax[name[1]]] = 1 if name[0] == "+" else -1
    S = np.cross(U, F)
    px, py, depth = v @ S, v @ U, v @ F
    x0, x1, y0, y1 = px.min(), px.max(), py.min(), py.max()
    span = max(x1 - x0, y1 - y0)
    W, H = max(1, int(round((x1 - x0) / span * 400))), max(1, int(round((y1 - y0) / span * 400)))
    ix = np.clip(((px - x0) / span * 400).astype(int), 0, W - 1)
    iy = np.clip(((y1 - py) / span * 400).astype(int), 0, H - 1)
    order = np.argsort(depth)  # far first, nearest (largest depth along F, towards the camera) written last
    grey = np.zeros((H, W)); mask = np.zeros((H, W), bool)
    grey[iy[order], ix[order]] = col[order]; mask[iy[order], ix[order]] = True
    from scipy import ndimage  # noqa: E402  (close the splat gaps)
    mask = ndimage.binary_closing(mask, iterations=3)
    grey = ndimage.grey_closing(grey, size=5)
    M, G = fit(mask, grey)
    iou = (M & refM).sum() / max(1, (M | refM).sum())
    both = M & refM
    corr = float(np.corrcoef(G[both], refG[both])[0, 1]) if both.sum() > 50 else 0.0
    scores[name] = {"iou": round(float(iou), 3), "greyCorr": round(corr, 3), "score": round(float(iou) + 0.5 * corr, 3)}
best = max(scores, key=lambda k: scores[k]["score"])
print(json.dumps({"front": best, "scores": scores}))
