"""TRELLIS.2 (via the trellis-mac MPS port) on one or several cut-outs, without the gated models.

  cd <trellis-mac checkout> && HF_HOME=<weights dir> .venv/bin/python -I <this> <out-dir> <rgba.png> [<rgba.png> ...]
      [--dino=<converted DINOv3 dir>] [--mode=stochastic|multidiffusion] [--pipeline=512] [--seed=42] [--steps=N]

Changes against `generate.py` of trellis-mac:
- RMBG-2.0 (gated, CC BY-NC) is never loaded: the inputs are already RGBA cut-outs (prep_inputs.py), and
  TRELLIS.2's preprocess uses the alpha channel when there is one.
- DINOv3 is loaded from a local folder converted from timm's ungated redistribution (dinov3_timm_to_hf.py).
- Multi-image conditioning, which TRELLIS.2 dropped, is re-added the way TRELLIS v1 does it (tuning-free):
  `stochastic` gives each sampler step the next image's condition in turn; `multidiffusion` averages the
  velocity predicted under every image's condition at each step (N times the cost).
Writes raw.ply (vertex colours sampled from the voxel base colour), timing.json.
"""
import os, sys, json, time
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("ATTN_BACKEND", "sdpa")
os.environ.setdefault("SPARSE_ATTN_BACKEND", "sdpa")
try:
    import flex_gemm  # noqa: F401
    os.environ.setdefault("SPARSE_CONV_BACKEND", "flex_gemm")
except (ImportError, RuntimeError):
    os.environ.setdefault("SPARSE_CONV_BACKEND", "none")
ROOT = os.getcwd()
BACKEND = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--backend=")), "mps")
sys.path.insert(0, ROOT if BACKEND == "mlx" else os.path.join(ROOT, "TRELLIS.2"))
sys.path.append(os.path.join(ROOT, "stubs"))

import numpy as np
import torch
from PIL import Image

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
pos = [a for a in sys.argv[1:] if not a.startswith("--")]
out, images = pos[0], pos[1:]
os.makedirs(out, exist_ok=True)
mode = args.get("mode", "stochastic")
timing = {"backend": BACKEND, "images": images, "mode": mode if len(images) > 1 else "single", "sparseConvBackend": os.environ["SPARSE_CONV_BACKEND"]}

from trellis2.pipelines import rembg as rembg_mod
from trellis2.modules import image_feature_extractor as ife


class NoRembg:  # never called: inputs carry alpha
    def __init__(self, **kw): pass
    def to(self, *a): return self
    def cpu(self): return self
    def __call__(self, img): raise RuntimeError("inputs must be RGBA cut-outs")


rembg_mod.BiRefNet = NoRembg
_init = ife.DinoV3FeatureExtractor.__init__
def _dino_init(self, model_name, *a, **kw):
    _init(self, args.get("dino", model_name), *a, **kw)
ife.DinoV3FeatureExtractor.__init__ = _dino_init

t0 = time.time()
if BACKEND == "mlx":  # trellis2-apple: MLX models inside the upstream orchestration
    from mlx_backend import dinov3 as mlx_dino, pipeline as mlx_pipe
    import huggingface_hub
    _orig = huggingface_hub.hf_hub_download
    def _local(repo, fname, **kw):
        return os.path.join(repo, fname) if os.path.isdir(repo) else _orig(repo, fname, **kw)
    huggingface_hub.hf_hub_download = _local
    _load = mlx_dino.load_dinov3_from_hf
    mlx_pipe.load_dinov3_from_hf = lambda name, *a, **k: _load(args.get("dino", name), *a, **k)
    from huggingface_hub import snapshot_download
    pipe = mlx_pipe.create_mlx_pipeline(snapshot_download("microsoft/TRELLIS.2-4B"))
else:
    from trellis2.pipelines.trellis2_image_to_3d import Trellis2ImageTo3DPipeline
    pipe = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
    pipe.to(torch.device("mps"))
timing["loadS"] = round(time.time() - t0, 1)

imgs = [pipe.preprocess_image(Image.open(p)) for p in images]
for i, im in enumerate(imgs):
    im.save(os.path.join(out, f"input-{i:02d}.png"))

# Multi-image: make get_cond return all conditions, and wrap each sampler's outer _inference_model.
if len(imgs) > 1:
    _get_cond = pipe.get_cond
    pipe.get_cond = lambda image, res, include_neg_cond=True: _get_cond(imgs, res, include_neg_cond)
    n = len(imgs)
    for name in ("sparse_structure_sampler", "shape_slat_sampler", "tex_slat_sampler"):
        s = getattr(pipe, name)
        old = s._inference_model
        state = {"k": 0}
        def make(old=old, state=state):
            def inf(model, x_t, t, cond, **kw):
                neg = kw.pop("neg_cond", None)
                def one(i):
                    kk = dict(kw)
                    if neg is not None:
                        kk["neg_cond"] = neg[i:i + 1]
                    return old(model, x_t, t, cond[i:i + 1], **kk)
                if mode == "multidiffusion":
                    return sum(one(i) for i in range(n)) / n
                i = state["k"] % n; state["k"] += 1
                return one(i)
            return inf
        s._inference_model = make()

kw = {}
if args.get("steps"):
    kw = {k: {"steps": int(args["steps"])} for k in ("sparse_structure_sampler_params", "shape_slat_sampler_params", "tex_slat_sampler_params")}
t0 = time.time()
res = pipe.run(imgs[0], seed=int(args.get("seed", 42)), pipeline_type=args.get("pipeline", "512"), preprocess_image=False, **kw)
timing["generateS"] = round(time.time() - t0, 1)
m = res[0] if isinstance(res, list) else res
v = m.vertices.cpu().numpy(); f = m.faces.cpu().numpy()
timing["rawVertices"], timing["rawTriangles"] = int(len(v)), int(len(f))
# Vertex colour = base colour of the nearest voxel.
from scipy.spatial import cKDTree
coords = m.coords.cpu().float().numpy()[:, -3:]
attrs = m.attrs.cpu().float().numpy()
vs = float(m.voxel_size)
origin = m.origin.cpu().float().numpy() if hasattr(m, "origin") else np.array([-0.5, -0.5, -0.5])
centres = origin + (coords + 0.5) * vs
_, idx = cKDTree(centres).query(v)
base = attrs[idx][:, 0:3]
base = (np.clip(base * 0.5 + 0.5 if base.min() < -0.01 else base, 0, 1) * 255).astype(np.uint8)
import trimesh
trimesh.Trimesh(v, f, vertex_colors=np.c_[base, np.full(len(base), 255, np.uint8)], process=False).export(os.path.join(out, "raw.ply"))
json.dump(timing, open(os.path.join(out, "timing.json"), "w"), indent=1)
print(json.dumps(timing))
