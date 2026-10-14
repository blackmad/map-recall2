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
if len(raw.faces) > 200000:  # generator output (TRELLIS.2): weld, then keep face-connected components >= min-component
    raw.merge_vertices()
    cc = trimesh.graph.connected_components(raw.face_adjacency, min_len=1)
    diag = np.linalg.norm(raw.extents)  # keep pieces that span >= 8 % of the object; drop the speckle shells
    big = [c for c in cc if np.linalg.norm(np.ptp(raw.vertices[raw.faces[c].ravel()], axis=0)) >= 0.08 * diag]
    raw.update_faces(np.isin(np.arange(len(raw.faces)), np.concatenate(big)))
    raw.remove_unreferenced_vertices()
if args.get("remesh"):
    # --remesh=N: voxelise at N cells over the longest side, close 1-cell gaps, fill, marching cubes. Turns
    # TRELLIS.2's holed, shelled surface (no hole filling on Mac) into one watertight skin that decimates cleanly.
    from scipy import ndimage
    from skimage import measure
    from scipy.spatial import cKDTree
    pitch = raw.extents.max() / int(args["remesh"])
    vg = raw.voxelized(pitch)
    occ = np.pad(vg.matrix, 3)
    # Close holes up to ~2 cells: dilate the shell, flood the outside, everything else is solid; erode back.
    d = ndimage.binary_dilation(occ, iterations=2)
    lab, _ = ndimage.label(~d)
    occ = ndimage.binary_erosion(lab != lab[0, 0, 0], iterations=2) | occ
    vv, ff, _, _ = measure.marching_cubes(ndimage.gaussian_filter(occ.astype(np.float32), 0.8), 0.5)
    vv = (vv - 3) * pitch + vg.translation
    col = np.asarray(raw.visual.vertex_colors)[cKDTree(raw.vertices).query(vv)[1]]
    raw = trimesh.Trimesh(vv, ff[:, ::-1], vertex_colors=col, process=False)
m = o3d.geometry.TriangleMesh(o3d.utility.Vector3dVector(raw.vertices), o3d.utility.Vector3iVector(raw.faces))
m.vertex_colors = o3d.utility.Vector3dVector(np.asarray(raw.visual.vertex_colors)[:, :3] / 255.0)
m.remove_duplicated_vertices(); m.remove_duplicated_triangles(); m.remove_degenerate_triangles()  # welds unindexed generator output (TRELLIS.2)
# Drop floating debris: keep components with at least min-component of the triangles.
labels, counts, _ = m.cluster_connected_triangles()
labels, counts = np.asarray(labels), np.asarray(counts)
keep = counts[labels] >= float(args.get("min-component", 0.02)) * len(labels)
m.remove_triangles_by_mask(~keep)
m.remove_unreferenced_vertices()
before = len(m.triangles)
m = m.simplify_quadric_decimation(target_number_of_triangles=target)
if len(m.triangles) > 2 * target:
    # Open3D stalls on the fragmented marching-cubes output of TRELLIS.2 (hundreds of thousands of tiny
    # non-manifold pieces); fall back to fast-simplification, colours carried by nearest original vertex.
    import fast_simplification
    from scipy.spatial import cKDTree
    v0, c0 = np.asarray(m.vertices), np.asarray(m.vertex_colors)
    vs, fs = v0.astype(np.float32), np.asarray(m.triangles).astype(np.int32)
    for _ in range(6):  # one pass stops early on fragmented input; repeat until near the target
        if len(fs) <= 1.2 * target: break
        vs, fs = fast_simplification.simplify(vs, fs, 1 - target / len(fs), agg=9)
    m = o3d.geometry.TriangleMesh(o3d.utility.Vector3dVector(vs), o3d.utility.Vector3iVector(fs))
    m.vertex_colors = o3d.utility.Vector3dVector(c0[cKDTree(v0).query(vs)[1]])
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
# --plinth=w,d,h: the input is the figure only; scale it to height - h and stand it on a w x d x h box.
plinth = [float(x) for x in args["plinth"].split(",")] if args.get("plinth") else None
ph = plinth[2] if plinth else 0.0
scale = (float(args["height"]) - ph) / local[:, 1].max()
local *= scale
local[:, 1] += ph
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
if plinth:
    box = trimesh.creation.box(extents=[plinth[0], ph, plinth[1]])
    box.apply_translation([0, ph / 2, 0])
    box.apply_transform(trimesh.transformations.rotation_matrix(-b, [0, 1, 0]))
    box.visual.vertex_colors = np.tile([72, 72, 70, 255], (len(box.vertices), 1)).astype(np.uint8)
    tm = trimesh.util.concatenate([tm, box])
trimesh.Scene(tm).export(out)
ext = verts.max(0) - verts.min(0)
print(json.dumps({"rawTriangles": int(len(raw.faces)), "afterDebris": before, "triangles": int(len(tm.faces)),
                  "scale": round(scale, 3), "sizeM": [round(float(e), 2) for e in ext], "watertight": bool(tm.is_watertight)}))
