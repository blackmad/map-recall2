"""strip.py <out.jpg> <height> label=path ... : side-by-side labelled strip of images at one height."""
import sys
from PIL import Image, ImageDraw
out, H = sys.argv[1], int(sys.argv[2])
ims = []
for a in sys.argv[3:]:
    n, f = a.split("=", 1)
    im = Image.open(f).convert("RGB")
    im = im.resize((max(1, int(im.width * H / im.height)), H))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 8 * len(n) + 10, 18), fill=(0, 0, 0))
    d.text((5, 3), n, fill=(255, 255, 0))
    ims.append(im)
W = sum(i.width for i in ims) + 6 * (len(ims) - 1)
o = Image.new("RGB", (W, H), "white")
x = 0
for i in ims:
    o.paste(i, (x, 0)); x += i.width + 6
o.save(out, quality=85)
print(out, o.size)
