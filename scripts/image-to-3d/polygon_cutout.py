"""A cut-out from a hand-set polygon (a tympanum triangle, a medallion) where BiRefNet cannot separate a relief from its wall.

    python -I scripts/image-to-3d/polygon_cutout.py <image> <out.png> x,y x,y x,y ...   (view pixels)
Writes the polygon's bounding box as RGBA with alpha = the polygon (1 px feather)."""
import sys
from PIL import Image, ImageDraw, ImageFilter
img = Image.open(sys.argv[1]).convert("RGB")
pts = [tuple(float(v) for v in p.split(",")) for p in sys.argv[3:]]
m = Image.new("L", img.size, 0)
ImageDraw.Draw(m).polygon(pts, fill=255)
m = m.filter(ImageFilter.GaussianBlur(0.7))
xs, ys = [p[0] for p in pts], [p[1] for p in pts]
box = (int(max(0, min(xs) - 2)), int(max(0, min(ys) - 2)), int(min(img.width, max(xs) + 2)), int(min(img.height, max(ys) + 2)))
out = img.crop(box); out.putalpha(m.crop(box)); out.save(sys.argv[2])
print(sys.argv[2], box)
