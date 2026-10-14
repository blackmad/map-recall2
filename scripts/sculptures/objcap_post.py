"""Object Capture post-process, run inside Blender (its bundled Python has bpy and numpy):

    blender -b --factory-startup --python-exit-code 1 -P scripts/sculptures/objcap_post.py -- \
        --obj=<objcap out>/obj --poses=<objcap out>/poses.json --out=<prefix> --height=<m> --plinth=<m> --facing=<deg> \
        [--world=<pano-views source.json>] [--front=<photo file name>] [--radius=0.9] [--tris=6000] \
        [--bronze=#4a4038] [--stone=#c9c2ae] [--raw]

Object Capture writes the model in its own frame (arbitrary origin, scale and yaw). Alignment to the statue:

* --world (panorama views, pano-views.ts): the registered panorama cameras have known RD/NAP positions, so a
  similarity transform (Umeyama) from Object Capture camera centres to (RD - statue, NAP - ground) gives scale,
  gravity, north and position in metres. Its RMS residual is reported; needs >= 3 registered panorama views.
* otherwise (Commons photos): up is the direction perpendicular to all camera x-axes (photos are near-level),
  the statue is the point nearest every optical axis (photographers centre it), the front is the camera of
  --front (default: the first registered photo), and the scale comes from --height alone.

Then: crop to a vertical cylinder of --radius metres about the statue between ground - 0.1 m and the top,
scale to --height (the measured height is reported first), decimate to --tris, and write, in the landmark GLB frame
(x east, y up, z south, base on y = 0, front turned to --facing):

* <prefix>-textured.glb: Object Capture's baked texture kept (review sheets);
* <prefix>.glb: shipped variant, no texture, no UVs, no vertex colour; faces below --plinth are material
  `stone` (materialSlot stone), the rest `bronze` (materialSlot paint), each with a `tint`, like the kit statues;
* <prefix>.json: the alignment summary.
--raw writes <prefix>-raw.glb of the whole reconstruction in the aligned frame without cropping, for diagnosis;
with --native as well, in Object Capture's own frame (no alignment).
"""
import json
import math
import sys

import bmesh
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
args = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in argv if a.startswith("--"))
height, plinth, facing = float(args["height"]), float(args.get("plinth", 0)), float(args.get("facing", 0))
radius, tris = float(args.get("radius", 0.9)), int(args.get("tris", 6000))
summary = {"obj": args["obj"], "height": height, "facingDeg": facing}

# ---- poses: camera-to-model 4x4, column-major; camera looks down -z, y up (ARKit convention).
poses = json.load(open(args["poses"]))["poses"]
cams = {}
for p in poses:
    M = np.array(p["matrix"], dtype=float).reshape(4, 4).T
    cams[p["file"]] = {"c": M[:3, 3], "x": M[:3, 0] / np.linalg.norm(M[:3, 0]), "y": M[:3, 1] / np.linalg.norm(M[:3, 1]),
                       "f": -M[:3, 2] / np.linalg.norm(M[:3, 2])}
summary["registered"] = sorted(cams)

def nearest_point(lines):
    A, b = np.zeros((3, 3)), np.zeros(3)
    for o, d in lines:
        P = np.eye(3) - np.outer(d, d)
        A += P
        b += P @ o
    return np.linalg.solve(A, b)

# Statue point from the optical axes (every panorama view and most photos aim at it).
centre = nearest_point([(c["c"], c["f"]) for c in cams.values()])
axis_miss = [float(np.linalg.norm((np.eye(3) - np.outer(c["f"], c["f"])) @ (centre - c["c"]))) for c in cams.values()]

world = json.load(open(args["world"])) if "world" in args else None
views = {v["file"].split("/")[-1]: v for v in (world or {}).get("views", []) if "file" in v}
pano_pairs = [(cams[n]["c"], v) for n, v in views.items() if n in cams]
if world and len(pano_pairs) >= 3:
    ground = float(np.median([v["groundNap"] for _, v in pano_pairs]))
    src = np.array([c for c, _ in pano_pairs])
    dst = np.array([[v["cameraRd"][0] - world["statueRd"]["x"], v["cameraRd"][1] - world["statueRd"]["y"], v["cameraRd"][2] - ground] for _, v in pano_pairs])
    # Rotation from the camera orientations, which are known exactly for the panorama views (yaw = bearing to the
    # statue, pitch recorded, roll 0): R_world_cam = R * R_model_cam, averaged and projected onto SO(3). Camera
    # centres alone cannot fix it: the capture cars drive along one or two straight lines, so the roll about that
    # line is unconstrained (an Umeyama fit put the cameras looking at the sky). Scale and translation then come
    # from the centres by least squares, with a second pass after dropping centres more than 3 m off.
    def world_cam(v):
        yaw, pitch = math.radians(v["bearingDeg"]), math.radians(v["pitchDeg"])
        fw = np.array([math.sin(yaw) * math.cos(pitch), math.cos(yaw) * math.cos(pitch), math.sin(pitch)])
        rt = np.array([math.cos(yaw), -math.sin(yaw), 0.0])
        return np.c_[rt, np.cross(rt, fw), -fw]
    names = [n for n in views if n in cams]
    Msum = sum(world_cam(views[n]) @ np.c_[cams[n]["x"], cams[n]["y"], -cams[n]["f"]].T for n in names)
    U, _, Vt = np.linalg.svd(Msum)
    R = U @ np.diag([1, 1, np.linalg.det(U @ Vt)]) @ Vt
    rot_err = [math.degrees(math.acos(max(-1, min(1, (np.trace(world_cam(views[n]).T @ R @ np.c_[cams[n]["x"], cams[n]["y"], -cams[n]["f"]]) - 1) / 2)))) for n in names]
    keep_idx = np.arange(len(src))
    for _ in range(2):
        a, b = (R @ src[keep_idx].T).T, dst[keep_idx]
        am, bm = a.mean(0), b.mean(0)
        s = float(((a - am) * (b - bm)).sum() / ((a - am) ** 2).sum())
        t = bm - s * am
        resid = np.linalg.norm((s * (R @ src.T)).T + t - dst, axis=1)
        keep_idx = np.where(resid < 3.0)[0]
    summary["alignment"] = {"method": "rotation from panorama view orientations, scale and offset from camera centres", "panoramaViews": len(pano_pairs),
                            "inliers3m": int(len(keep_idx)), "rmsInliersM": round(float(np.sqrt((resid[keep_idx] ** 2).mean())), 3),
                            "medianRotationErrorDeg": round(float(np.median(rot_err)), 2), "maxM": round(float(resid.max()), 3),
                            "scaleModelToM": round(s, 4), "groundNap": ground}
    # Where the optical axes meet, in metres from the anchor: a check on the statue anchor and the alignment.
    summary["alignment"]["axesMeetM"] = [round(float(v), 2) for v in s * R @ centre + t]
    to_world = lambda P: (s * (R @ P.T)).T + t  # noqa: E731
    anchor = np.zeros(3)
else:
    X = np.array([c["x"] for c in cams.values()])
    w, V = np.linalg.eigh(X.T @ X)
    up = V[:, 0]
    if np.mean([c["y"] @ up for c in cams.values()]) < 0:
        up = -up
    front_name = args.get("front") if args.get("front") in cams else sorted(cams)[0]
    fc = cams[front_name]["c"] - centre
    fwd = fc - (fc @ up) * up
    fwd /= np.linalg.norm(fwd)
    # World frame (x east, y north, z up): the front points to compass `facing`.
    b = math.radians(facing)
    fw_world = np.array([math.sin(b), math.cos(b), 0.0])
    right = np.cross(fwd, up)
    rw = np.cross(fw_world, [0, 0, 1.0])
    Rm = np.outer(fw_world, fwd) + np.outer(rw, right) + np.outer([0, 0, 1.0], up)
    dist = float(np.median([np.linalg.norm(c["c"] - centre) for c in cams.values()]))
    # Provisional metric scale: assume the median photo distance is 8 m; the final scale comes from --height.
    s = 8.0 / dist
    to_world = lambda P: s * (Rm @ (P - centre).T).T  # noqa: E731
    anchor = np.zeros(3)
    summary["alignment"] = {"method": "camera x-axes for gravity, optical axes for the centre, front photo for yaw, height for scale",
                            "front": front_name, "upResidual": round(float(w[0] / w.sum()), 4), "medianAxisMissModel": round(float(np.median(axis_miss)), 3),
                            "provisionalScale": round(s, 4)}

# ---- mesh
bpy.ops.wm.read_factory_settings(use_empty=True)
import glob  # noqa: E402
obj_file = glob.glob(args["obj"].rstrip("/") + "/*.obj")[0]
bpy.ops.wm.obj_import(filepath=obj_file, forward_axis="NEGATIVE_Z", up_axis="Y")
ob = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = ob
# The importer turned OBJ (x, y, z) into Blender (x, -z, y); undo that so vertices are Object Capture coordinates.
me = ob.data
ob.matrix_world.identity()
co = np.empty(len(me.vertices) * 3)
me.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
co = np.c_[co[:, 0], co[:, 2], -co[:, 1]]
summary["rawTriangles"] = sum(len(p.vertices) - 2 for p in me.polygons)
if "native" in args:
    # Object Capture's frame is y-up; recentre it on the bounding box, base on 0, and turn it z-up for the export.
    wco = np.c_[co[:, 0], -co[:, 2], co[:, 1]]
    wco -= [(wco[:, 0].min() + wco[:, 0].max()) / 2, (wco[:, 1].min() + wco[:, 1].max()) / 2, wco[:, 2].min()]
else:
    wco = to_world(co)
me.vertices.foreach_set("co", wco.ravel())
me.update()

def export(path, only_selected=True):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=only_selected, export_extras=True,
                              export_yup=True, export_apply=True)

if "raw" in args:
    export(args["out"] + ("-native.glb" if "native" in args else "-raw.glb"))
    if "native" in args:
        sys.exit(0)

# Crop: faces with their centroid inside the cylinder.
bm = bmesh.new()
bm.from_mesh(me)
cent = np.array([f.calc_center_median() for f in bm.faces])
r = np.hypot(cent[:, 0] - anchor[0], cent[:, 1] - anchor[1])
inside = r < radius
zin = cent[inside, 2]
if world and len(pano_pairs) >= 3:
    z0 = -0.3  # NAP ground of the panorama cars; the statue base can sit a little above or below
else:
    z0 = float(np.percentile(zin, 1)) if len(zin) else 0
keep = inside & (cent[:, 2] > z0 - 0.3)
bmesh.ops.delete(bm, geom=[f for f, k in zip(bm.faces, keep) if not k], context="FACES")
# Keep the connected piece(s) holding most of the faces; drop small floaters.
bm.faces.ensure_lookup_table()
seen, comps = set(), []
for f in bm.faces:
    if f.index in seen:
        continue
    stack, comp = [f], []
    seen.add(f.index)
    while stack:
        g = stack.pop()
        comp.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index)
                    stack.append(h)
    comps.append(comp)
comps.sort(key=len, reverse=True)
total = sum(len(c) for c in comps)
drop = [f for c in comps if len(c) < 0.03 * total for f in c]
bmesh.ops.delete(bm, geom=drop, context="FACES")
bm.to_mesh(me)
bm.free()
me.update()
co = np.empty(len(me.vertices) * 3)
me.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
if not len(co):
    summary["error"] = "crop is empty"
    json.dump(summary, open(args["out"] + ".json", "w"), indent=1)
    print(json.dumps(summary))
    sys.exit(1)
zmin, zmax = co[:, 2].min(), co[:, 2].max()
measured = float(zmax - zmin)
summary["croppedTriangles"] = sum(len(p.vertices) - 2 for p in me.polygons)
summary["measuredHeightM" if world and len(pano_pairs) >= 3 else "measuredHeightProvisional"] = round(measured, 2)
summary["components"] = [len(c) for c in comps[:5]]
k = height / measured
co[:, 0] = (co[:, 0] - anchor[0]) * k
co[:, 1] = (co[:, 1] - anchor[1]) * k
co[:, 2] = (co[:, 2] - zmin) * k
summary["finalScale"] = round(k, 3)
summary["footprintM"] = [round(float(co[:, 0].max() - co[:, 0].min()), 2), round(float(co[:, 1].max() - co[:, 1].min()), 2)]
me.vertices.foreach_set("co", co.ravel())
me.update()

# Decimate (collapse keeps the UVs).
n = sum(len(p.vertices) - 2 for p in me.polygons)
if n > tris:
    mod = ob.modifiers.new("dec", "DECIMATE")
    mod.ratio = tris / n
    bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.object.mode_set(mode="OBJECT")
summary["triangles"] = len(me.polygons)
for m in me.materials:
    if m:
        m["materialSlot"] = "paint"
        m["tint"] = args.get("bronze", "#4a4038")
        m["materialSlotSource"] = "objcap-textured"
export(args["out"] + "-textured.glb")

# Shipped variant: two flat materials split by height, no UVs, no vertex colour.
def flat(name, slot, tint):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    rgb = [int(tint[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = [c ** 2.2 for c in rgb] + [1]
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    m["materialSlot"], m["tint"] = slot, tint
    return m

me.materials.clear()
me.materials.append(flat("bronze", "paint", args.get("bronze", "#4a4038")))
me.materials.append(flat("stone", "stone", args.get("stone", "#c9c2ae")))
for p in me.polygons:
    zc = sum(me.vertices[v].co.z for v in p.vertices) / len(p.vertices)
    p.material_index = 1 if zc < plinth else 0
summary["stoneTriangles"] = sum(1 for p in me.polygons if p.material_index == 1)
while me.uv_layers:
    me.uv_layers.remove(me.uv_layers[0])
while me.color_attributes:
    me.color_attributes.remove(me.color_attributes[0])
for p in me.polygons:
    p.use_smooth = False
export(args["out"] + ".glb")
json.dump(summary, open(args["out"] + ".json", "w"), indent=1)
print("OBJCAP_POST", json.dumps(summary))
