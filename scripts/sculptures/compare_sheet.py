# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==10.1.0"]
# ///
"""Review sheet for route B: an inputs row (photo, cut-out, network input) above the kit and route B four-side strips.

    python -I scripts/sculptures/compare_sheet.py <out.png> <photo> <cutout.png> <input.png> <kit-strip.png> <routeB-strip.png> \
        [--jpg=<out.jpg>] [--title=<text>]

--jpg also writes a downscaled JPEG under 300 KB (quality lowered until it fits) for docs/images/sculptures/.
"""
import os
import sys

from PIL import Image, ImageDraw

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
pos = [a for a in sys.argv[1:] if not a.startswith("--")]
out, photo, cutout, netin, kit, rb = pos
strips = [Image.open(kit).convert("RGB"), Image.open(rb).convert("RGB")]
W = max(s.width for s in strips)
H = 360


def fit(path, bg=(235, 235, 235)):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        base = Image.new("RGB", im.size, bg)
        base.paste(im, mask=im.split()[-1])
        im = base
    im = im.convert("RGB")
    s = H / im.height
    return im.resize((max(1, int(im.width * s)), H))


row = Image.new("RGB", (W, H), (255, 255, 255))
x = 0
for p in (photo, cutout, netin):
    im = fit(p)
    row.paste(im, (x, 0))
    x += im.width + 10
d = ImageDraw.Draw(row)
d.text((x + 10, 10), args.get("title", ""), fill=(0, 0, 0))
d.text((x + 10, 30), "left to right: source photo, cut-out, network input. Below: kit model, then route B (TripoSR).", fill=(60, 60, 60))
rows = [row] + strips
sheet = Image.new("RGB", (W, sum(r.height for r in rows) + 12 * (len(rows) - 1)), (255, 255, 255))
y = 0
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height + 12
sheet.save(out)
if "jpg" in args:
    im = sheet
    if im.width > 1600:
        im = im.resize((1600, int(im.height * 1600 / im.width)), Image.LANCZOS)
    q = 85
    while True:
        im.save(args["jpg"], quality=q, optimize=True)
        if os.path.getsize(args["jpg"]) < 295_000 or q <= 40:
            break
        q -= 5
    print("jpg", args["jpg"], os.path.getsize(args["jpg"]), "q", q)
