# /// script
# requires-python = "==3.11.*"
# dependencies = ["open3d==0.18.0", "numpy==1.26.4", "trimesh==4.0.5"]
# ///
"""Route B post-process: decimate a TripoSR mesh, stand it up, scale it to the real height, face it, export GLB.

    python -I scripts/sculptures/decimate_scale_glb.py <raw.ply> <out.glb> --height=<m> --facing=<compass deg> \
        [--tris=6000] [--front=+x] [--up=z] [--min-component=0.02] [--lift=<m>] [--no-colors]

    --lift raises the mesh so its base sits at y = lift (a figure placed on a kit plinth); --no-colors writes a colourless mesh
    (reconstruct.ts then assigns a tagged city-look material instead of baking the photo colours).

TripoSR's frame: z up, and the input photo's camera sits on +x, so the front of the subject faces +x
(checked on the De Dokwerker strip: the face and the 1941 lettering point where --front says).
Output frame: the landmark GLB frame (x east, y up, z south), feet/plinth base on y = 0, centred in plan,
front turned to the compass bearing --facing. Small floating components (cut-out debris) are dropped.
Prints a JSON summary. Run without torch in the same process (open3d 0.18 + torch 2.5 segfault on macOS).
"""
import json
import math
import sys

import numpy as np
import open3d as o3d
import trimesh

args = dict((a[2:].split("=", 1) + ["1"])[:2] for a in sys.argv[3:] if a.startswith("--"))
src, out = sys.argv[1], sys.argv[2]
target = int(args.get("tris", 6000))
raw = trimesh.load(src, process=False)
m = o3d.geometry.TriangleMesh(o3d.utility.Vector3dVector(raw.vertices), o3d.utility.Vector3iVector(raw.faces))
m.vertex_colors = o3d.utility.Vector3dVector(np.asarray(raw.visual.vertex_colors)[:, :3] / 255.0)
# Drop floating debris: keep components with at least min-component of the triangles.
labels, counts, _ = m.cluster_connected_triangles()
labels, counts = np.asarray(labels), np.asarray(counts)
keep = counts[labels] >= float(args.get("min-component", 0.02)) * len(labels)
m.remove_triangles_by_mask(~keep)
m.remove_unreferenced_vertices()
before = len(m.triangles)
m = m.simplify_quadric_decimation(target_number_of_triangles=target)
m.remove_degenerate_triangles()
m.remove_unreferenced_vertices()
v = np.asarray(m.vertices).copy()
axis = {"x": 0, "y": 1, "z": 2}
up = axis[args.get("up", "z")]
front = args.get("front", "+x")
fsign, fax = (-1.0 if front.startswith("-") else 1.0), axis[front[-1]]
side = 3 - up - fax
# Local basis: F = front, U = up, S = F x U-ish lateral axis.
F = np.zeros(3); F[fax] = fsign
U = np.zeros(3); U[up] = 1.0
S = np.cross(U, F)
local = np.c_[v @ F, v @ U, v @ S]  # (front, up, side)
local[:, 1] -= local[:, 1].min()
scale = float(args["height"]) / local[:, 1].max()
local *= scale
local[:, 0] -= (local[:, 0].min() + local[:, 0].max()) / 2
local[:, 2] -= (local[:, 2].min() + local[:, 2].max()) / 2
# Facing: compass bearing b -> direction (east, south) = (sin b, -cos b) in the x-east/z-south frame.
b = math.radians(float(args.get("facing", 0)))
fdir = np.array([math.sin(b), -math.cos(b)])
# S = U x F in the source, so the target side axis is up x front = (fz, 0, -fx): a proper rotation, never a mirror.
sdir = np.array([fdir[1], -fdir[0]])
xz = local[:, [0]] * fdir + local[:, [2]] * sdir
verts = np.c_[xz[:, 0], local[:, 1] + float(args.get("lift", 0)), xz[:, 1]]
cols = (np.asarray(m.vertex_colors) * 255).clip(0, 255).astype(np.uint8)
vc = None if "no-colors" in args else np.c_[cols, np.full(len(cols), 255, np.uint8)]
tm = trimesh.Trimesh(verts, np.asarray(m.triangles), vertex_colors=vc, process=False)
tm.fix_normals()
trimesh.Scene(tm).export(out)
ext = verts.max(0) - verts.min(0)
print(json.dumps({"rawTriangles": int(len(raw.faces)), "afterDebris": before, "triangles": int(len(tm.faces)),
                  "scale": round(scale, 3), "sizeM": [round(float(e), 2) for e in ext], "watertight": bool(tm.is_watertight)}))
