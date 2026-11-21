"""Rebuild the per-pand crops for gold-crops.json (storeys) and souterrain-gold.json from git history alone.

strip.json comes from the newest commit of this repo (any ref) that added/modified
scripts/block-face/faces/<face>/strip.json; strip.jpg from map-recall2-source-data (any ref), taking the
newest version whose pixel size matches strip.json. Crops are the span's px columns, full strip height
(40 px/m, bottom row = strip ground line).

Usage: python3 -I build-crops.py OUT_DIR   (needs pillow; writes OUT_DIR/gold/*.png and OUT_DIR/sout/*.png)
"""
import io, json, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SD = os.environ.get("MAP_RECALL_SOURCE_DATA", "/Users/blackmad/Code/map-recall2-source-data")
G = "/usr/bin/git"
OUT = sys.argv[1]


def sh(*a, text=True):
    return subprocess.run(list(a), capture_output=True, text=text).stdout


def strip_json(face, ref=None):
    p = f"scripts/block-face/faces/{face}/strip.json"
    if ref:
        return json.loads(sh(G, "-C", R, "show", f"{ref}:{p}"))
    sha = sh(G, "-C", R, "log", "--all", "-1", "--diff-filter=AM", "--format=%H", "--", p).strip()
    return json.loads(sh(G, "-C", R, "show", f"{sha}:{p}"))


def strip_img(face, sj):
    for h in sh(G, "-C", SD, "log", "--all", "--format=%H", "--", f"block-face-strips/{face}/strip.jpg").split():
        b = sh(G, "-C", SD, "show", f"{h}:block-face-strips/{face}/strip.jpg", text=False)
        if b and Image.open(io.BytesIO(b)).size == (sj["width"], sj["height"]):
            return Image.open(io.BytesIO(b)).convert("RGB")
    raise SystemExit(f"no strip.jpg of size {sj['width']}x{sj['height']} for {face}")


def cut(rows, sub, ref=None):
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    cache = {}
    for r in rows:
        f = r["face"]
        if f not in cache:
            sj = strip_json(f, ref)
            cache[f] = (sj, strip_img(f, sj))
        sj, im = cache[f]
        x0, x1 = next(s["px"] for s in sj["spans"] if s["pandId"] == r["pandId"])
        im.crop((x0, 0, x1, im.height)).save(os.path.join(OUT, sub, r["file"]))
    print(sub, len(rows), "crops from", len(cache), "faces")


# the storeys gold was labelled on crops cut from the lane/vision-measure-20261110 tree's strip.json
cut(list(json.load(open(os.path.join(HERE, "gold-crops.json"))).values()), "gold", ref="lane/vision-measure-20261110")
cut(json.load(open(os.path.join(HERE, "souterrain-gold.json"))), "sout")
