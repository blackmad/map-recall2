# /// script
# requires-python = ">=3.11"
# dependencies = ["laspy[lazrs]==2.5.4", "numpy==1.26.4", "Pillow==10.1.0"]
# ///
"""Top-down RGB and height images of a square crop of a LAZ tile, to locate a statue.

    python -I scripts/sculptures/crop_topdown.py <tile.laz> <rdX> <rdY> <out-prefix> [half=8] [cell=0.08]

Writes <out-prefix>-rgb.png and <out-prefix>-height.png (north up, 1 px per cell, a red cross at the anchor)
and <out-prefix>-crop.npz (x, y, z, rgb8) for the reconstruction step.
"""
import sys

import laspy
import numpy as np
from PIL import Image, ImageDraw

path, x0, y0, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
half = float(sys.argv[5]) if len(sys.argv) > 5 else 8.0
cell = float(sys.argv[6]) if len(sys.argv) > 6 else 0.08
las = laspy.read(path)
x, y, z = np.asarray(las.x), np.asarray(las.y), np.asarray(las.z)
m = (np.abs(x - x0) < half) & (np.abs(y - y0) < half)
x, y, z = x[m], y[m], z[m]
rgb = np.stack([np.asarray(las.red)[m], np.asarray(las.green)[m], np.asarray(las.blue)[m]], 1).astype(np.float64)
if rgb.max() > 255:
    rgb = rgb / 257.0
rgb8 = np.clip(rgb, 0, 255).astype(np.uint8)
np.savez_compressed(out + "-crop.npz", x=x - x0, y=y - y0, z=z, rgb=rgb8)
n = int(round(2 * half / cell))
ix = np.clip(((x - x0 + half) / cell).astype(int), 0, n - 1)
iy = np.clip(((y0 + half - y) / cell).astype(int), 0, n - 1)
img = np.zeros((n, n, 3), np.uint8)
img[iy, ix] = rgb8
hz = np.full((n, n), np.nan)
hz[iy, ix] = z
ground = np.nanpercentile(z, 5)
h = np.clip((hz - ground) / 4.0, 0, 1)
himg = (np.nan_to_num(h) * 255).astype(np.uint8)
for arr, suffix in ((img, "rgb"), (np.stack([himg] * 3, 2), "height")):
    im = Image.fromarray(arr).resize((n * 4, n * 4), Image.NEAREST)
    d = ImageDraw.Draw(im)
    c = n * 2
    d.line([(c - 12, c), (c + 12, c)], fill=(255, 0, 0), width=2)
    d.line([(c, c - 12), (c, c + 12)], fill=(255, 0, 0), width=2)
    im.save(f"{out}-{suffix}.png")
print("points", len(x), "ground(p5)", round(float(ground), 2), "height scale: white = ground + 4 m")
