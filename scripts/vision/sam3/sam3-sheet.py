"""Contact sheets of SAM 3 masks over the crops: window rows (colour per row; grey = dropped), dormers (cyan),
doors (magenta), stairs/railing (yellow), with gold vs predicted in the caption.

  python3 sam3-sheet.py storeys PROBE_DIR CROP_DIR OUT.jpg [KEY,KEY,...]
  python3 sam3-sheet.py souterrain PROBE_DIR CROP_DIR OUT.jpg [IDX,IDX,...]
Needs numpy and pillow."""
import json, os, sys, importlib.util
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ev", os.path.join(HERE, "sam3-eval.py"))
ev = importlib.util.module_from_spec(spec); spec.loader.exec_module(ev)
COL = [(255, 60, 60), (60, 200, 60), (60, 120, 255), (255, 160, 0), (200, 0, 200), (0, 200, 200), (255, 255, 0)]


def tint(im, mask, col, a=0.45):
    arr = np.asarray(im).astype(float)
    arr[mask] = arr[mask] * (1 - a) + np.array(col) * a
    return Image.fromarray(arr.astype(np.uint8))


def tile_storeys(d, im, cap):
    s, b, dbg = ev.measure(d)
    up = {id(w) for r in dbg["upper"] for w in r}
    for i, r in enumerate(dbg["rows"]):
        for w in r:
            im = tint(im, w["mask"], COL[i % len(COL)] if id(w) in up else (140, 140, 140))
    for q in dbg["dorm"]:
        im = tint(im, q["mask"], (0, 230, 230), 0.3)
    for q in dbg["doors"]:
        im = tint(im, q["mask"], (230, 0, 230), 0.3)
    return im, cap + f" pred s={s} b={b}"


def tile_sout(d, im, cap):
    y, low, stoop = ev.souterrain_rule(d)
    for w in ev.inst(d, "window", 0.4):
        im = tint(im, w["mask"], (140, 140, 140), 0.35)
    for w in low:
        im = tint(im, w["mask"], (255, 40, 40), 0.6)
    for q in stoop:
        im = tint(im, q["mask"], (255, 220, 0), 0.4)
    return im, cap + f" pred={'Y' if y else 'N'}"


def main():
    mode, probe, crops, out = sys.argv[1:5]
    sel = sys.argv[5].split(",") if len(sys.argv) > 5 else None
    tiles = []
    if mode == "storeys":
        g = json.load(open(os.path.join(HERE, "gold-crops.json")))
        for k in (sel or sorted(g, key=int)):
            r = g[k]; d = ev.load(probe, r["file"]); im = Image.open(os.path.join(crops, r["file"])).convert("RGB")
            tiles.append(tile_storeys(d, im, f"#{k} gold={r['storeysV2']}/{r['bays']} 3dbag={r['storeys3dbag']}"))
        H = 520
    else:
        g = json.load(open(os.path.join(HERE, "souterrain-gold.json")))
        for i, r in enumerate(g):
            if sel and str(r["idx"]) not in sel:
                continue
            d = ev.load(probe, r["file"]); im = Image.open(os.path.join(crops, r["file"])).convert("RGB")
            t, cap = tile_sout(d, im, f"{r['idx']} gold={'Y' if r['souterrain'] else 'N'}")
            tiles.append((t.crop((0, max(0, t.height - 280), t.width, t.height)), cap))  # bottom 7 m
        H = 260
    MAXW = 1800; lines = []; cur = []; w = 0
    for im, cap in tiles:
        s = H / im.height; im = im.resize((max(1, int(im.width * s)), H))
        if im.width > MAXW:
            im = im.crop((0, 0, MAXW, H))
        if w + im.width + 10 > MAXW and cur:
            lines.append(cur); cur = []; w = 0
        cur.append((im, cap)); w += im.width + 10
    lines.append(cur)
    sh = Image.new("RGB", (MAXW, (H + 30) * len(lines)), "white"); dr = ImageDraw.Draw(sh)
    for li, line in enumerate(lines):
        x = 0
        for im, cap in line:
            sh.paste(im, (x, li * (H + 30) + 28)); dr.text((x + 2, li * (H + 30) + 2), cap, fill="black"); x += im.width + 10
    sh.save(out, quality=85)
    print(out, sh.size)


main()
