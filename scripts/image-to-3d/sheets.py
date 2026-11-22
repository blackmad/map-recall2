"""Blind sheets and labelled overview sheets for the image-to-3D trial.

    python -I sheets.py <artifacts/image-to-3d> <model> [<model> ...]

Per model x input: blind/<model>--<input>.jpg, photo | A | B with the front row on top and the oblique (35 deg)
row below; A/B is today or the model, shuffled with a seeded RNG, the key in blind/key.json (not shown to the judge).
Per model: overview-<model>.jpg, one row per input, labelled: photo | today front | today oblique | model front | model oblique.
"""
import json, os, random, sys
from PIL import Image, ImageDraw

A = sys.argv[1]
models = sys.argv[2:]
inputs = json.load(open(f"{A}/inputs/inputs.json"))
os.makedirs(f"{A}/blind", exist_ok=True)
keyf = f"{A}/blind/key.json"
key = json.load(open(keyf)) if os.path.exists(keyf) else {}
PW, PH = 420, 520


def fit(path, w=PW, h=PH, bg=(255, 255, 255)):
    c = Image.new("RGB", (w, h), bg)
    if path and os.path.exists(path):
        im = Image.open(path).convert("RGB")
        s = min(w / im.width, h / im.height)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        c.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    else:
        ImageDraw.Draw(c).text((w // 2 - 40, h // 2), "no output", fill=(200, 0, 0))
    return c


def lab(im, text):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 9 * len(text) + 14, 22), fill=(31, 35, 40))
    d.text((7, 5), text, fill=(255, 255, 255))
    return im


def today(k, meta):
    if meta["kind"] == "front":
        t = f"{A}/today/{meta['pandId']}"
        return f"{t}/front.png", f"{t}/threeq.png"
    return f"{A}/today-orn/{k}.png", f"{A}/today-orn/{k}-oblique.png"


def grid(cells, cols):
    rows = (len(cells) + cols - 1) // cols
    g = Image.new("RGB", (cols * PW + (cols - 1) * 6, rows * PH + (rows - 1) * 6), (244, 244, 242))
    for i, c in enumerate(cells):
        g.paste(c, ((i % cols) * (PW + 6), (i // cols) * (PH + 6)))
    return g


for m in models:
    rows = []
    for k, meta in inputs.items():
        pl = f"{A}/runs/{m}/{k}/placed"
        mf, mo = f"{pl}/front.png", f"{pl}/oblique.png"
        tf, to = today(k, meta)
        photo = f"{A}/inputs/{k}.png"
        rid = f"{m}--{k}"
        if rid not in key:
            key[rid] = random.Random(rid).choice(["A=today", "A=model"])
        a_is_today = key[rid] == "A=today"
        af, ao, bf, bo = (tf, to, mf, mo) if a_is_today else (mf, mo, tf, to)
        cells = [lab(fit(photo), "photo"), lab(fit(af), "A front"), lab(fit(bf), "B front"),
                 lab(fit(photo), "photo"), lab(fit(ao), "A oblique ~35 deg"), lab(fit(bo), "B oblique ~35 deg")]
        g = grid(cells, 3)
        g.save(f"{A}/blind/{rid}.jpg", quality=82)
        rows.append(grid([lab(fit(photo), f"{k} photo"), lab(fit(tf), "today front"), lab(fit(to), "today oblique"),
                          lab(fit(mf), f"{m} front"), lab(fit(mo), f"{m} oblique")], 5))
    W = max(r.width for r in rows)
    ov = Image.new("RGB", (W, sum(r.height + 6 for r in rows)), (244, 244, 242))
    y = 0
    for r in rows:
        ov.paste(r, (0, y)); y += r.height + 6
    ov = ov.resize((ov.width // 2, ov.height // 2), Image.LANCZOS)
    ov.save(f"{A}/overview-{m}.jpg", quality=80)
    print(m, f"{A}/overview-{m}.jpg", ov.size)
json.dump(key, open(keyf, "w"), indent=1)
