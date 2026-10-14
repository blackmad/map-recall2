# /// script
# requires-python = ">=3.11"
# dependencies = ["laspy[lazrs]==2.5.4", "numpy==1.26.4"]
# ///
"""Print header, dimensions and a radius crop summary of a LAZ tile around an RD point.

    python -I scripts/sculptures/probe_laz.py <tile.laz> <rdX> <rdY> [radius=8]
"""
import sys

import laspy
import numpy as np

path, x0, y0 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
radius = float(sys.argv[4]) if len(sys.argv) > 4 else 8.0
las = laspy.read(path)
print("points", len(las.points), "dims", list(las.point_format.dimension_names))
print("bounds", las.header.mins, las.header.maxs)
x, y, z = np.asarray(las.x), np.asarray(las.y), np.asarray(las.z)
d = np.hypot(x - x0, y - y0)
m = d < radius
print("within", radius, "m:", m.sum(), "pts; density", round(m.sum() / (np.pi * radius ** 2), 1), "pts/m2")
zz = z[m]
print("z percentiles 1/5/50/95/99:", np.percentile(zz, [1, 5, 50, 95, 99]).round(2))
for r in (0.5, 1.0, 1.5, 2.0):
    mm = d < r
    print(f"r<{r}: n={mm.sum()} density={mm.sum() / (np.pi * r * r):.0f}/m2 zmax={z[mm].max() if mm.any() else None}")
if "classification" in las.point_format.dimension_names:
    c, n = np.unique(np.asarray(las.classification)[m], return_counts=True)
    print("classes", dict(zip(c.tolist(), n.tolist())))
