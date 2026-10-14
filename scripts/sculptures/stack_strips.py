# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==10.1.0"]
# ///
"""Stack strip PNGs vertically into one comparison sheet:

    python -I scripts/sculptures/stack_strips.py <out.png> <a.png> [b.png ...] ["photo:<title>|<img>[|<img> ...]"]

A `photo:` argument is a row of source photos (up to four, scaled to fill a strip's width at the strip's height) with
a title bar like landmark-strip.ts, so the reconstruction rows can be compared with the photos they came from.
A .jpg out path is saved as JPEG quality 82.
"""
import sys

from PIL import Image, ImageDraw, ImageFont

out, args = sys.argv[1], sys.argv[2:]
strips = [Image.open(p).convert("RGB") for p in args if not p.startswith("photo:")]
w = max(i.width for i in strips)
h = strips[0].height


def photo_row(spec):
    title, *paths = spec[len("photo:"):].split("|")
    row = Image.new("RGB", (w, h), (242, 241, 238))
    d = ImageDraw.Draw(row)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
    except OSError:
        font = ImageFont.load_default()
    d.text((10, 8), title, fill=(30, 30, 30), font=font)
    top, cell = 40, w // max(4, len(paths))
    for k, p in enumerate(paths):
        im = Image.open(p).convert("RGB")
        im.thumbnail((cell - 8, h - top - 4))
        row.paste(im, (k * cell + (cell - im.width) // 2, top))
    return row


ims, si = [], 0
for p in args:
    if p.startswith("photo:"):
        ims.append(photo_row(p))
    else:
        ims.append(strips[si])
        si += 1
sheet = Image.new("RGB", (w, sum(i.height for i in ims) + 12 * (len(ims) - 1)), (255, 255, 255))
y = 0
for im in ims:
    sheet.paste(im, (0, y))
    y += im.height + 12
if out.lower().endswith(".jpg"):
    sheet.save(out, quality=82)
else:
    sheet.save(out)
