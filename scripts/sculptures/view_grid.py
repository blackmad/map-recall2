"""grid.py out.jpg img1 [img2 ...]: side-by-side copies (each 480 px tall) with a 100 px grid in original pixels, labelled."""
import sys
from PIL import Image, ImageDraw
out, paths = sys.argv[1], sys.argv[2:]
H = 640
tiles = []
for k, p in enumerate(paths):
    im = Image.open(p).convert("RGB")
    s = H / im.height
    t = im.resize((int(im.width * s), H))
    d = ImageDraw.Draw(t)
    for x in range(0, im.width, 100):
        d.line([(x * s, 0), (x * s, H)], fill=(255, 0, 0) if x % 500 == 0 else (255, 255, 0), width=1)
        if x % 200 == 0: d.text((x * s + 2, 2), str(x), fill=(255, 0, 0))
    for y in range(0, im.height, 100):
        d.line([(0, y * s), (t.width, y * s)], fill=(255, 0, 0) if y % 500 == 0 else (255, 255, 0), width=1)
        if y % 200 == 0: d.text((2, y * s + 2), str(y), fill=(255, 0, 0))
    d.text((t.width // 2, H - 14), f"#{k}", fill=(0, 255, 255))
    tiles.append(t)
W = sum(t.width for t in tiles) + 8 * len(tiles)
sheet = Image.new("RGB", (W, H), (0, 0, 0))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0)); x += t.width + 8
sheet.save(out, quality=85)
