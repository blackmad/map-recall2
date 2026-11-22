"""BiRefNet cut-outs without the ComfyUI server: the same weights and the same model code
(ComfyUI's comfy.bg_removal_model), loaded in one short process. Light enough to run while a world compile holds the
machine (about 1 GB, a few seconds per image on MPS/CPU).

    <venv-comfy>/bin/python -I scripts/image-to-3d/birefnet_local.py --comfy=<ComfyUI dir> --out=<dir> \
        <image>[:x0,y0,x1,y1] ...

Each image is optionally cropped (box in fractions of the image, or pixels when any value > 1) and written as
<out>/<stem>.png, RGBA, alpha = the BiRefNet mask, plus <out>/<stem>-mask.png. The largest connected component of the
mask is kept (cut-out debris dropped), unless --all-components.
"""
import os
import sys

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
flags = {a[2:] for a in sys.argv[1:] if a.startswith("--") and "=" not in a}
items = [a for a in sys.argv[1:] if not a.startswith("--")]
items = [os.path.abspath(i.partition(":")[0]) + (":" + i.partition(":")[2] if i.partition(":")[2] else "") for i in items]
out_dir = os.path.abspath(args["out"])
os.makedirs(out_dir, exist_ok=True)
comfy = os.path.abspath(args["comfy"])
sys.path.insert(0, comfy)
os.chdir(comfy)

import numpy as np  # noqa: E402
import torch  # noqa: E402
from PIL import Image  # noqa: E402
from comfy.bg_removal_model import load  # noqa: E402

model = load(os.path.join(comfy, "models/background_removal/birefnet.safetensors"))
for item in items:
    src, _, box = item.partition(":")
    img = Image.open(src).convert("RGB")
    if box:
        b = [float(v) for v in box.split(",")]
        if max(b) <= 1:
            b = [b[0] * img.width, b[1] * img.height, b[2] * img.width, b[3] * img.height]
        img = img.crop(tuple(int(v) for v in b))
    t = torch.from_numpy(np.asarray(img).astype(np.float32) / 255.0)[None]
    mask = model.encode_image(t)
    m = mask[0].detach().float().cpu().numpy()
    m = np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).resize(img.size, Image.BILINEAR))
    if "all-components" not in flags:
        from scipy import ndimage
        lab, n = ndimage.label(m > 128)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(m), lab, range(1, n + 1))
            keep = lab == (int(np.argmax(sizes)) + 1)
            keep = ndimage.binary_dilation(keep, iterations=2)
            m = np.where(keep, m, 0).astype(np.uint8)
    stem = os.path.splitext(os.path.basename(src))[0]
    rgba = img.copy()
    rgba.putalpha(Image.fromarray(m))
    rgba.save(os.path.join(out_dir, f"{stem}.png"))
    Image.fromarray(m).save(os.path.join(out_dir, f"{stem}-mask.png"))
    print(stem, img.size, round(float((m > 128).mean()), 3), flush=True)
