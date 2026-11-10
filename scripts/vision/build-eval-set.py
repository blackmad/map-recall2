# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "numpy"]
# ///
"""Build the vision-measure evaluation set: per-pand crops cut from archived
block-face strips, with ground truth from placed block-face records.

Truth: bays = likeness.columns.model (the placed type's bay count at that
width), storeys = the placed type's body.storeys. Only placed pands (those that
passed the evidence, match and likeness gates) are used.

Usage: build-eval-set.py OUT_DIR
"""
import glob, json, os, sys
from PIL import Image

OUT = sys.argv[1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
roots = glob.glob("/Users/blackmad/Code/map-recall2-worktrees/*/staging/block-face") + [
    "/Users/blackmad/Code/map-recall2/staging/block-face",
    os.environ.get("MAP_RECALL_SOURCE_DATA", "/Users/blackmad/Code/map-recall2-source-data") + "/block-face-strips",
]
strips = {}
for r in roots:
    for f in sorted(glob.glob(r + "/*/strip.jpg")):
        strips.setdefault(f.split("/")[-2], f)
types = {}
for f in glob.glob(ROOT + "/scripts/block-face/types/*/*.json"):
    d = json.load(open(f))
    types[d["id"]] = d
os.makedirs(OUT, exist_ok=True)
rows = []
for f in sorted(glob.glob(ROOT + "/scripts/block-face/faces/*/auto-place.json")):
    face = f.split("/")[-2]
    if face not in strips:
        continue
    sj = json.load(open(os.path.dirname(f) + "/strip.json"))
    spans = {s["pandId"]: s for s in sj["spans"]}
    im = None
    for p in json.load(open(f))["pands"]:
        if p["status"] != "placed" or p["pandId"] not in spans:
            continue
        t = types.get(p["type"])
        lk = p.get("likeness") or {}
        cols = (lk.get("columns") or {}).get("model")
        if not t or cols is None or "storeys" not in t.get("body", {}):
            continue
        fit = (t.get("fit") or {}).get("storeys")
        x0, x1 = spans[p["pandId"]]["px"]
        if x1 - x0 < 100:
            continue
        if im is None:
            im = Image.open(strips[face]).convert("RGB")
        name = f"{face}__{p['pandId']}.png"
        im.crop((x0, 0, x1, im.height)).save(os.path.join(OUT, name))
        rows.append(dict(file=name, face=face, pandId=p["pandId"], address=p["address"], widthM=p["widthM"],
                         ppm=sj["pixelsPerMetre"], heightM=sj["heightM"], type=p["type"],
                         bays=cols, baysPhotoClassic=(lk.get("columns") or {}).get("photo"),
                         storeys=t["body"]["storeys"], storeysFit=fit, storeys3dbag=p.get("storeys3dbag"),
                         wall=(p.get("strip") or {}).get("wall")))
json.dump(rows, open(os.path.join(OUT, "truth.json"), "w"), indent=1)
print(len(rows), "crops")
