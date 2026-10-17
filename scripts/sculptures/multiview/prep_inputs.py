# /// script
# requires-python = ">=3.11"
# dependencies = ["rembg==2.0.59", "pillow", "numpy", "scipy", "onnxruntime"]
# ///
"""Statue cut-outs for the multi-view trial.

  python -I prep_inputs.py <inputs.json> <out-dir>

inputs.json: {"views": [{"name", "src", "box": [x0, y0, x1, y1], "model": "isnet-general-use"|"u2net"}]}
Writes per view `<name>-crop.png` (RGB box crop, the geometry models' input), `<name>-rgba.png`
(cut-out, largest component, centred on a square with 10 % margin: the generative models' input)
and `<name>-mask.png`.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import new_session, remove

spec = json.load(open(sys.argv[1])); out = sys.argv[2]
os.makedirs(out, exist_ok=True)
sessions = {}
for v in spec["views"]:
    img = Image.open(v["src"]).convert("RGB")
    if v.get("box"):  # clamped to the image, so 9999 means "to the edge"
        x0, y0, x1, y1 = v["box"]
        if max(v["box"]) <= 1:  # fractions of the image
            x0, x1, y0, y1 = int(x0 * img.width), int(x1 * img.width), int(y0 * img.height), int(y1 * img.height)
        crop = img.crop((max(0, x0), max(0, y0), min(img.width, x1), min(img.height, y1)))
    else:
        crop = img
    crop.save(os.path.join(out, f"{v['name']}-crop.png"))
    if v.get("upscale"):
        crop = crop.resize((crop.width * v["upscale"], crop.height * v["upscale"]), Image.LANCZOS)
    model = v.get("model", "isnet-general-use")
    sess = sessions.setdefault(model, new_session(model))
    rgba = np.array(remove(crop, session=sess))
    a = rgba[:, :, 3] > 127
    lab, n = ndimage.label(a)
    if n > 1:
        sizes = ndimage.sum(a, lab, range(1, n + 1)); a = lab == (1 + int(np.argmax(sizes)))
    rgba[:, :, 3] = np.where(a, rgba[:, :, 3], 0)
    Image.fromarray((a * 255).astype(np.uint8)).save(os.path.join(out, f"{v['name']}-mask.png"))
    ys, xs = np.nonzero(a)
    if len(xs) == 0:
        print(v["name"], "EMPTY"); continue
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if v.get("keepTop"):  # figure only: drop the plinth below this share of the cut-out height
        y1 = y0 + int((y1 - y0) * v["keepTop"])
        rgba[y1:, :, 3] = 0
        xs2 = np.nonzero(rgba[y0:y1, :, 3] > 127)[1]; x0, x1 = xs2.min(), xs2.max() + 1
    obj = Image.fromarray(rgba).crop((x0, y0, x1, y1))
    side = int(max(obj.size) * 1.1)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(obj, ((side - obj.size[0]) // 2, (side - obj.size[1]) // 2))
    sq.resize((518, 518), Image.LANCZOS).save(os.path.join(out, f"{v['name']}-rgba.png"))
    print(v["name"], "fg", round(a.mean(), 3), "bbox", obj.size)
