# /// script
# requires-python = "==3.11.*"
# dependencies = [
#   "torch==2.5.1", "transformers==4.35.0", "huggingface-hub==0.17.3", "omegaconf==2.3.0", "einops==0.7.0",
#   "Pillow==10.1.0", "numpy==1.26.4", "trimesh==4.0.5", "scikit-image==0.24.0", "rembg==2.0.59",
#   "onnxruntime==1.19.2", "imageio==2.34.0",
# ]
# ///
"""Route B: single-photo image-to-3D with TripoSR (MIT, Tripo AI & Stability AI) on Apple silicon.

    python -I scripts/sculptures/run_triposr.py --src=<TripoSR checkout> --image=<photo> --out=<dir> \
        [--box=x0,y0,x1,y1] [--rembg=u2net|isnet-general-use] [--mc=256] [--device=mps|cpu] [--fg=0.85]

Changes against upstream run.py, nothing else touched:
  * torchmcubes (a CUDA/C++ extension) is replaced by skimage.measure.marching_cubes through a stub module;
  * the device is MPS (falls back to CPU) instead of CUDA, with PYTORCH_ENABLE_MPS_FALLBACK for one ViT op;
  * the cut-out keeps the largest rembg component inside an optional crop box.
Writes <out>/input.png (what the network saw), <out>/raw.ply (vertex-coloured, TripoSR frame) and <out>/timing.json.
Run open3d in a separate process (decimate_scale_glb.py): torch and open3d 0.18 segfault in one process on macOS.
"""
import json
import os
import sys
import time
import types

import numpy as np

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
sys.path.insert(0, os.path.abspath(args["src"]))
os.makedirs(args["out"], exist_ok=True)

# ViT's bicubic position-embedding resize has no MPS kernel in torch 2.5; that one op runs on the CPU.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
from skimage import measure  # noqa: E402
import torch  # noqa: E402


def _marching_cubes(vol: torch.Tensor, thresh: float):
    v, f, _, _ = measure.marching_cubes(vol.detach().cpu().numpy(), thresh)
    # torchmcubes returns (x, y, z) with x along the last array axis; skimage returns array index order.
    return torch.from_numpy(np.ascontiguousarray(v[:, ::-1])).float(), torch.from_numpy(f.astype(np.int64))


sys.modules["torchmcubes"] = types.SimpleNamespace(marching_cubes=_marching_cubes)

import rembg  # noqa: E402
from PIL import Image  # noqa: E402
from tsr.system import TSR  # noqa: E402
from tsr.utils import resize_foreground  # noqa: E402

t = {}
device = args.get("device", "mps")
if device == "mps" and not torch.backends.mps.is_available():
    device = "cpu"
t0 = time.time()
model = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
model.renderer.set_chunk_size(8192)
model.to(device)
t["loadS"] = round(time.time() - t0, 1)

t0 = time.time()
img = Image.open(args["image"]).convert("RGB")
if "box" in args:
    img = img.crop(tuple(int(v) for v in args["box"].split(",")))
session = rembg.new_session(args.get("rembg", "u2net"))
cut = rembg.remove(img, session=session)
alpha = np.array(cut)[:, :, 3]
lab = measure.label(alpha > 128)
if lab.max() > 0:
    big = np.argmax(np.bincount(lab.ravel())[1:]) + 1
    a = np.where(lab == big, alpha, 0).astype(np.uint8)
    cut.putalpha(Image.fromarray(a))
cut.save(os.path.join(args["out"], "cutout.png"))
fg = resize_foreground(cut, float(args.get("fg", 0.85)))
arr = np.array(fg).astype(np.float32) / 255.0
arr = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
image = Image.fromarray((arr * 255.0).astype(np.uint8))
image.save(os.path.join(args["out"], "input.png"))
t["cutoutS"] = round(time.time() - t0, 1)

t0 = time.time()
with torch.no_grad():
    codes = model([image], device=device)
if device == "mps":
    torch.mps.synchronize()
t["modelS"] = round(time.time() - t0, 1)
t0 = time.time()
mesh = model.extract_mesh(codes, True, resolution=int(args.get("mc", 256)))[0]
t["meshS"] = round(time.time() - t0, 1)
mesh.export(os.path.join(args["out"], "raw.ply"))
t.update(device=device, rawTriangles=int(len(mesh.faces)), rawVertices=int(len(mesh.vertices)), image=args["image"], box=args.get("box"))
with open(os.path.join(args["out"], "timing.json"), "w") as f:
    json.dump(t, f, indent=1)
print(json.dumps(t))
