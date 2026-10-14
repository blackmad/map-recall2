# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==10.1.0"]
# ///
"""Labelled contact sheet of images: python -I scripts/sculptures/contact_sheet.py <out.png> <cell-px> <img> [img ...]"""
import os
import sys

from PIL import Image, ImageDraw

out, cell, paths = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
cols = min(4, len(paths))
rows = (len(paths) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), "white")
for k, p in enumerate(paths):
    im = Image.open(p).convert("RGBA")
    im.thumbnail((cell, cell))
    bg = Image.new("RGB", im.size, (235, 235, 235))
    bg.paste(im, mask=im.split()[3])
    x, y = (k % cols) * cell, (k // cols) * (cell + 18)
    sheet.paste(bg, (x + (cell - bg.width) // 2, y + 18))
    ImageDraw.Draw(sheet).text((x + 4, y + 3), os.path.basename(p)[:48], fill="black")
sheet.save(out)
