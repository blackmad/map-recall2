# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==10.1.0"]
# ///
"""Stack strip PNGs vertically into one comparison sheet: python -I scripts/sculptures/stack_strips.py <out.png> <a.png> [b.png ...]"""
import sys

from PIL import Image

out, paths = sys.argv[1], sys.argv[2:]
ims = [Image.open(p).convert("RGB") for p in paths]
w = max(i.width for i in ims)
sheet = Image.new("RGB", (w, sum(i.height for i in ims) + 12 * (len(ims) - 1)), (255, 255, 255))
y = 0
for im in ims:
    sheet.paste(im, (0, y))
    y += im.height + 12
sheet.save(out)
