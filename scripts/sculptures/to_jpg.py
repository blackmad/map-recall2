# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==10.1.0"]
# ///
"""Downscale a sheet to a JPEG under 300 KB: python -I scripts/sculptures/to_jpg.py <in.png> <out.jpg> [width=1600]"""
import os
import sys

from PIL import Image

im = Image.open(sys.argv[1]).convert("RGB")
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
if im.width > w:
    im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
q = 85
while True:
    im.save(sys.argv[2], quality=q, optimize=True)
    if os.path.getsize(sys.argv[2]) < 295_000 or q <= 40:
        break
    q -= 5
print(sys.argv[2], os.path.getsize(sys.argv[2]), "q", q)
