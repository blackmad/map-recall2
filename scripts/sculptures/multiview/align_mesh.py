# /// script
# requires-python = "==3.11.*"
# dependencies = ["open3d==0.18.0", "numpy==1.26.4", "trimesh==4.0.5", "scipy", "fast-simplification"]
# ///
"""Put a feed-forward point map (run_geom.py) into the statue's metric frame using the panoramas' known
capture positions, cut the statue out in 3D, mesh it, and write a landmark-frame GLB.

  python -I align_mesh.py <geom.npz> <pano views.json> <out-dir> [--radius=1.2] [--top=5] [--conf=50] [--tris=6000]
      [--depth=8] [--height=4.13]

Every panorama view's camera centre is known (views.json camEnuM: metres east/north of the statue anchor,
2.44 m above the ground) and so is its viewing direction (bearing, elevation). A similarity transform
(Umeyama) from the predicted camera centres and look-at points to those positions puts the cloud in
metres, north-up, with the ground at z = 0 and the statue on the z axis. Residuals of that fit measure
whether the network registered the panoramas consistently. Points within --radius of the anchor and below
--top metres are the statue; Poisson meshes them. The output is not rescaled: its height is a measurement,
compared against --height (the kit height) in summary.json. Views not in views.json (Commons photos) only
contribute points if the network registered them with the panoramas.
"""
import json, math, os, sys
import numpy as np
import open3d as o3d
import trimesh
from scipy.spatial import cKDTree

args = dict(a[2:].split("=", 1) for a in sys.argv[4:] if a.startswith("--"))
geom, views_json, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
g = np.load(geom, allow_pickle=True)
pts, conf, rgb, c2w = g["pts"], g["conf"], g["rgb"], g["cam2world"]
names = [os.path.basename(str(n)) for n in g["names"]]
meta = {v["file"]: v for v in json.load(open(views_json))["views"]}
pano = [i for i, n in enumerate(names) if n in meta]
summary = {"views": names, "panoViews": len(pano)}
if len(pano) < 3:
    raise SystemExit("need >= 3 panorama views to fix the frame")

# Correspondences: centre and a point 10 m (target) / d_src (source) along the optical axis.
src_c = c2w[pano, :3, 3]
tgt_c = np.array([meta[names[i]]["camEnuM"] for i in pano], float)
def fwd(b, e):
    b, e = math.radians(b), math.radians(e)
    return np.array([math.sin(b) * math.cos(e), math.cos(b) * math.cos(e), math.sin(e)])
tgt_f = np.array([fwd(meta[names[i]]["bearingDeg"], meta[names[i]]["elevDeg"]) for i in pano])
src_f = c2w[pano, :3, 2]  # OpenCV +z forward
# Scale guess from centre spread, then look-at points at matching distances.
ds = np.linalg.norm(src_c - src_c.mean(0), axis=1).mean(); dt = np.linalg.norm(tgt_c - tgt_c.mean(0), axis=1).mean()
s0 = dt / max(ds, 1e-9)
L = 30.0  # metres: about the camera-statue distance
A = np.r_[src_c, src_c + src_f * (L / s0)]
B = np.r_[tgt_c, tgt_c + tgt_f * L]

def umeyama(A, B):
    ma, mb = A.mean(0), B.mean(0); a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(b.T @ a / len(A))
    D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (a ** 2).sum() * len(A)
    return s, R, mb - s * R @ ma

s, R, t = umeyama(A, B)
fit = lambda X: (s * (R @ X.T)).T + t
res_c = np.linalg.norm(fit(src_c) - tgt_c, axis=1)
ang = [math.degrees(math.acos(np.clip((R @ f) @ tf, -1, 1))) for f, tf in zip(src_f, tgt_f)]
summary.update({"scale": s, "centreResidualM": {"rms": float(np.sqrt((res_c ** 2).mean())), "max": float(res_c.max())},
                "axisErrorDeg": {"median": float(np.median(ang)), "max": float(max(ang))}})

W = fit(pts.reshape(-1, 3)).reshape(pts.shape)
thr = np.percentile(conf, float(args.get("conf", 50)), axis=(1, 2), keepdims=True)
r, top = float(args.get("radius", 1.2)), float(args.get("top", 5))
# Column diagnostic: the statue is the only thing 1.8-4.5 m tall within a few metres of the anchor on this
# square. Its centroid shows the residual registration offset; --recentre moves the cut there.
near = (np.hypot(W[..., 0], W[..., 1]) < 3.5) & (conf >= thr)
bands = {}
for z0 in np.arange(-0.5, 5.5, 0.5):
    sel = near & (W[..., 2] >= z0) & (W[..., 2] < z0 + 0.5)
    if sel.sum():
        bands[f"{z0:.1f}"] = [int(sel.sum()), round(float(np.median(W[..., 0][sel])), 2), round(float(np.median(W[..., 1][sel])), 2)]
summary["columnBands"] = bands
col = near & (W[..., 2] > 1.8) & (W[..., 2] < 4.5)
cx, cy = (float(np.median(W[..., 0][col])), float(np.median(W[..., 1][col]))) if col.sum() > 100 else (0.0, 0.0)
summary["columnCentreM"] = [round(cx, 2), round(cy, 2)]
if args.get("recentre"):
    W[..., 0] -= cx; W[..., 1] -= cy
inside = (np.hypot(W[..., 0], W[..., 1]) < r) & (W[..., 2] > -0.3) & (W[..., 2] < top) & (conf >= thr)
summary["statuePointsPerView"] = {names[i]: int(inside[i].sum()) for i in range(len(names))}
P = W[inside]; C = rgb[inside].astype(np.float64) / 255
summary["statuePoints"] = int(len(P))
json.dump(summary, open(os.path.join(out, "summary.json"), "w"), indent=1)  # early copy, in case meshing fails
if len(P) < 500:
    json.dump(summary, open(os.path.join(out, "summary.json"), "w"), indent=1); raise SystemExit(f"too few statue points: {len(P)}")
pc = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(P)); pc.colors = o3d.utility.Vector3dVector(C)
pc, _ = pc.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
pc = pc.voxel_down_sample(0.015)
o3d.io.write_point_cloud(os.path.join(out, "statue-points.ply"), pc)
Pz = np.asarray(pc.points)[:, 2]
summary["measuredHeightM"] = {"p1": float(np.percentile(Pz, 1)), "p99": float(np.percentile(Pz, 99)), "kit": float(args.get("height", 4.13))}
pc.estimate_normals(o3d.geometry.KDTreeSearchParamHybrid(radius=0.08, max_nn=30))
pc.orient_normals_towards_camera_location(np.array([0, 0, 2.0]))  # inward...
pc.normals = o3d.utility.Vector3dVector(-np.asarray(pc.normals))  # ...then flipped: outward from the axis
mesh, dens = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pc, depth=int(args.get("depth", 8)))
dens = np.asarray(dens)
mesh.remove_vertices_by_mask(dens < np.quantile(dens, 0.08))
mesh = mesh.crop(pc.get_axis_aligned_bounding_box())
mesh = mesh.simplify_quadric_decimation(int(args.get("tris", 6000)))
mesh.remove_unreferenced_vertices()
v = np.asarray(mesh.vertices); f = np.asarray(mesh.triangles)
col = np.asarray(pc.colors)[cKDTree(np.asarray(pc.points)).query(v)[1]]
v = v.copy(); v[:, 2] -= max(0.0, float(np.percentile(Pz, 1)))  # sit on y = 0
lv = np.c_[v[:, 0], v[:, 2], -v[:, 1]]  # ENU -> landmark frame (x east, y up, z south)
cols = (col * 255).clip(0, 255).astype(np.uint8)
tm = trimesh.Trimesh(lv, f, vertex_colors=np.c_[cols, np.full(len(cols), 255, np.uint8)], process=False)
trimesh.Scene(tm).export(os.path.join(out, "mesh.glb"))
summary.update({"triangles": int(len(f)), "sizeM": [round(float(e), 2) for e in lv.max(0) - lv.min(0)]})
json.dump(summary, open(os.path.join(out, "summary.json"), "w"), indent=1)
print(json.dumps({k: summary[k] for k in summary if k not in ("views", "statuePointsPerView")}))
