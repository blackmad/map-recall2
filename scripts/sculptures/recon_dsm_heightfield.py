# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy==1.26.4", "trimesh==4.0.5", "scipy==1.13.1"]
# ///
"""Route A (substitute): reconstruct a statue from the PDOK 2025 8 cm RGB DSM point cloud.

The DSM cloud is a dense-matching raster from aerial photographs exported as points: one Z per 8 cm cell,
seen from above only. A statue therefore can only be a 2.5-D height field; sides and undercuts do not exist
in the data. This script measures what the cloud holds at the statue and meshes it as a coloured height
field with a skirt down to the ground (no Poisson: the raster is already a surface, Poisson only smooths it).

    python -I scripts/sculptures/recon_dsm_heightfield.py <crop.npz from crop_topdown.py> <out.glb> \
        [--dx=0 --dy=0] [--half=1.6] [--real-height=<m>]

--dx/--dy move the statue centre (m east/north of the anchor) when the OSM node is off the bump.
Frame of the GLB: x east, y up, z south, origin at the statue centre on the ground (landmark GLB frame).
Prints a JSON summary (cells, density, peak height, triangles).
"""
import json
import sys

import numpy as np
import trimesh
from scipy.spatial import cKDTree

args = dict(a[2:].split("=", 1) for a in sys.argv[3:] if a.startswith("--"))
crop, out = sys.argv[1], sys.argv[2]
dx, dy, half = float(args.get("dx", 0)), float(args.get("dy", 0)), float(args.get("half", 1.6))
d = np.load(crop)
x, y, z, rgb = d["x"] - dx, d["y"] - dy, d["z"], d["rgb"]
r = np.hypot(x, y)
ring = (r > 2.5) & (r < 4.5)
ground = float(np.median(z[ring & (z < np.percentile(z[ring], 60))]))
h = z - ground
near = r < 1.5
raised = near & (h > 0.3)
summary = {
    "groundNAP": round(ground, 2),
    "cellsWithin8m": int((r < 8).sum()),
    "densityPerM2": round(float((r < 8).sum() / (np.pi * 64)), 1),
    "raisedCells": int(raised.sum()),
    "raisedAreaM2": round(float(raised.sum()) * 0.0064, 2),
    "peakAboveGroundM": round(float(h[near].max()), 2),
    "p95RaisedM": round(float(np.percentile(h[raised], 95)), 2) if raised.any() else None,
}
if "real-height" in args:
    summary["realHeightM"] = float(args["real-height"])
    summary["heightRecovered"] = round(summary["peakAboveGroundM"] / float(args["real-height"]), 2)

# Regular grid of the crop around the centre.
cell = 0.08
n = int(round(2 * half / cell)) + 1
gx = np.linspace(-half, half, n)
GX, GY = np.meshgrid(gx, gx[::-1])
tree = cKDTree(np.c_[x, y])
_, idx = tree.query(np.c_[GX.ravel(), GY.ravel()])
H = np.clip(h[idx].reshape(n, n), 0, None)
H[H < 0.12] = 0.0  # flatten pavement noise
C = rgb[idx].reshape(n, n, 3)
verts, cols, faces = [], [], []
for j in range(n):
    for i in range(n):
        verts.append([GX[j, i], H[j, i], -GY[j, i]])
        cols.append(C[j, i])
vid = lambda j, i: j * n + i
for j in range(n - 1):
    for i in range(n - 1):
        a, b, c, e = vid(j, i), vid(j, i + 1), vid(j + 1, i), vid(j + 1, i + 1)
        faces += [[a, c, b], [b, c, e]]
mesh = trimesh.Trimesh(np.array(verts), np.array(faces), vertex_colors=np.c_[np.array(cols), np.full(len(cols), 255)], process=True)
# Drop flat pavement far from the statue: keep faces whose any vertex is raised or within 0.5 m of a raised cell.
raisedV = mesh.vertices[:, 1] > 0.12
if raisedV.any():
    rt = cKDTree(mesh.vertices[raisedV][:, [0, 2]])
    dist, _ = rt.query(mesh.vertices[:, [0, 2]])
    keep = (dist < 0.4)[mesh.faces].all(1)
    mesh.update_faces(keep)
    mesh.remove_unreferenced_vertices()
mesh.fix_normals()
summary["triangles"] = int(len(mesh.faces))
scene = trimesh.Scene(mesh)
scene.export(out)
print(json.dumps(summary))
