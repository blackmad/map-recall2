"""Labelled bake-off sheet: one row per input, photo | today | each model (front over 35 deg oblique).

    python -I key_sheet.py <artifacts/image-to-3d> <out.jpg> <model> [<model> ...]"""
import json, sys
from PIL import Image, ImageDraw
A, out, models = sys.argv[1], sys.argv[2], sys.argv[3:]
inputs = json.load(open(f"{A}/inputs/inputs.json"))
W, H = 230, 300


def cell(path, text):
    c = Image.new("RGB", (W, H), (255, 255, 255))
    try:
        im = Image.open(path).convert("RGB")
        s = min(W / im.width, (H - 20) / im.height)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        c.paste(im, ((W - im.width) // 2, 20 + (H - 20 - im.height) // 2))
    except FileNotFoundError:
        pass
    d = ImageDraw.Draw(c)
    d.rectangle((0, 0, W, 16), fill=(31, 35, 40)); d.text((4, 3), text, fill=(255, 255, 255))
    return c


rows = []
for k, m in inputs.items():
    t = (f"{A}/today/{m['pandId']}/front.png", f"{A}/today/{m['pandId']}/threeq.png") if m["kind"] == "front" \
        else (f"{A}/today-orn/{k}.png", f"{A}/today-orn/{k}-oblique.png")
    cells = [cell(f"{A}/inputs/{k}.png", k), cell(t[0], "today")] + [cell(f"{A}/runs/{x}/{k}/placed/front.png", x) for x in models]
    cells += [Image.new("RGB", (W, H), (255, 255, 255)), cell(t[1], "today oblique")] + \
             [cell(f"{A}/runs/{x}/{k}/placed/oblique.png", x + " 35deg") for x in models]
    rows.append(cells)
n = 2 + len(models)
sheet = Image.new("RGB", (n * W, len(rows) * 2 * H), (240, 240, 238))
for r, cells in enumerate(rows):
    for i, c in enumerate(cells):
        sheet.paste(c, ((i % n) * W, (r * 2 + i // n) * H))
sheet.save(out, quality=80)
print(out, sheet.size)
