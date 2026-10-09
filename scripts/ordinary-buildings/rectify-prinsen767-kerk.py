"""Analytical source views on the native Kerkstraat wall plane, never textures.

uv run --with numpy --with pillow python ... PRIVATE_SOURCE26 PRIVATE_SOURCE35
The 2.1m camera eye is an explicit approximation, not a measured facade height.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

if len(sys.argv) != 3:
    raise SystemExit("Usage: rectify-prinsen767-kerk.py PRIVATE_SOURCE26 PRIVATE_SOURCE35")
old, pack = map(Path, sys.argv[1:])
candidate = json.loads((old / "candidate-derived.json").read_text())
ring = candidate["feature"]["geometry"]["coordinates"][0]
a, b = ring[6], ring[7]
anchor = candidate["center"]
kx = 111320 * math.cos(math.radians(anchor[1]))
width = math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 111320)
w, h = 1600, 900
u = (np.arange(w) + .5) / w
y = 17.0 - (np.arange(h) + .5) / h * 17.5
lng = a[0] + u * (b[0] - a[0])
lat = a[1] + u * (b[1] - a[1])
records = []
for view in json.loads((pack / "kerk126-selected-views.json").read_text()):
    camera = view["panorama"]["geometry"]["coordinates"]
    east = (lng - camera[0]) * kx
    north = (lat - camera[1]) * 111320
    vertical = y[:, None] - 2.1
    length = np.sqrt(east[None, :] ** 2 + north[None, :] ** 2 + vertical ** 2)
    image = np.asarray(Image.open(pack / view["file"]).convert("RGB"))
    ih, iw = image.shape[:2]
    x = np.broadcast_to(((np.arctan2(east, north) / (2 * math.pi) + .5) % 1) * iw, (h, w))
    yy = np.clip((.5 - np.arcsin(vertical / length) / math.pi) * ih, 0, ih - 1)
    ix, iy = np.floor(x).astype(int) % iw, np.floor(yy).astype(int)
    tx, ty = (x - np.floor(x))[..., None], (yy - np.floor(yy))[..., None]
    pixel = ((image[iy, ix] * (1 - tx) + image[iy, (ix + 1) % iw] * tx) * (1 - ty)
             + (image[np.minimum(iy + 1, ih - 1), ix] * (1 - tx)
                + image[np.minimum(iy + 1, ih - 1), (ix + 1) % iw] * tx) * ty)
    name = f"rectified-{view['id']}-{view['year']}.jpg"
    Image.fromarray(np.uint8(pixel)).save(pack / "processed" / name, quality=94)
    records.append({"source": view["file"], "output": "processed/" + name,
                    "nativeVertices": [6, 7], "endpointsWGS84": [a, b], "widthMetresApprox": width,
                    "cameraEyeMetresApprox": 2.1, "verticalRangeMetresApprox": [-.5, 17],
                    "warning": "Approximate planar source diagnostic; projecting volumes/parallax remain. Not calibrated measured elevations or model texture."})
(pack / "processed/kerk126-rectification-metadata.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps({"views": len(records), "nativeWidthMetresApprox": width}))
