"""SAM 3 (facebook/sam3, transformers Sam3Model) concept-segmentation probe on rectified facade crops.

Research spike 2026-11-21 (docs/reports/sam3-storeys-20261121.md). Runs every prompt in PROMPTS on each
crop listed in an index JSON and writes one compressed .npz per crop (boxes, scores, packed masks per prompt)
plus timings and memory to OUT_DIR/run.json.

Usage (from the SAM 3 venv, which lives outside the repo):
  python -I sam3-probe.py --weights ~/Code/sam3-20261121/weights --crops CROP_DIR --index INDEX.json --out OUT_DIR
           [--prompts window,dormer,...] [--threshold 0.3] [--dtype fp32|fp16] [--limit N]

INDEX.json: a list of {"file": ...} rows or a dict of key -> {"file": ...} (gold-crops.json, souterrain-gold.json).
Crops are padded to a square (grey) before the 1008 px resize so the aspect ratio is kept; boxes and masks are
returned in crop pixels.
"""
import argparse, json, os, time, resource
import numpy as np
import torch
from PIL import Image
from transformers import Sam3Model, Sam3Processor

PROMPTS = ["window", "dormer", "balcony", "door", "shop window", "stairs", "railing", "sidewalk", "roof"]

ap = argparse.ArgumentParser()
ap.add_argument("--weights", required=True)
ap.add_argument("--crops", required=True)
ap.add_argument("--index", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--prompts", default=",".join(PROMPTS))
ap.add_argument("--threshold", type=float, default=0.3)
ap.add_argument("--dtype", default="fp32")
ap.add_argument("--limit", type=int, default=0)
a = ap.parse_args()
prompts = [p.strip() for p in a.prompts.split(",") if p.strip()]
dev = "mps" if torch.backends.mps.is_available() else "cpu"
dt = torch.float16 if a.dtype == "fp16" else torch.float32
os.makedirs(a.out, exist_ok=True)

t0 = time.time()
proc = Sam3Processor.from_pretrained(a.weights)
model = Sam3Model.from_pretrained(a.weights, torch_dtype=dt).to(dev).eval()
load_s = time.time() - t0
idx = json.load(open(a.index))
rows = list(idx.values()) if isinstance(idx, dict) else idx
if a.limit:
    rows = rows[: a.limit]

# text embeddings once per prompt
with torch.no_grad():
    text = {}
    for p in prompts:
        ti = proc(text=p, return_tensors="pt").to(dev)
        text[p] = ti

times = []
for r in rows:
    name = r["file"]
    im = Image.open(os.path.join(a.crops, name)).convert("RGB")
    W, H = im.size
    S = max(W, H)
    sq = Image.new("RGB", (S, S), (128, 128, 128))
    ox, oy = (S - W) // 2, (S - H) // 2
    sq.paste(im, (ox, oy))
    t = time.time()
    res = {}
    with torch.no_grad():
        ii = proc(images=sq, return_tensors="pt").to(dev)
        pv = ii["pixel_values"].to(dt)
        ve = model.get_vision_features(pixel_values=pv)
        for p in prompts:
            out = model(vision_embeds=ve, input_ids=text[p]["input_ids"], attention_mask=text[p].get("attention_mask"))
            pp = proc.post_process_instance_segmentation(out, threshold=a.threshold, mask_threshold=0.5,
                                                         target_sizes=[(S, S)])[0]
            m = pp["masks"].cpu().numpy().astype(bool)[:, oy:oy + H, ox:ox + W]
            b = pp["boxes"].float().cpu().numpy().reshape(-1, 4) - np.array([ox, oy, ox, oy])
            res[p] = (b, pp["scores"].float().cpu().numpy(), m)
    if dev == "mps":
        torch.mps.synchronize()
    sec = time.time() - t
    times.append(sec)
    np.savez_compressed(os.path.join(a.out, name.rsplit(".", 1)[0] + ".npz"), W=W, H=H,
                        **{f"{p}|boxes": v[0] for p, v in res.items()},
                        **{f"{p}|scores": v[1] for p, v in res.items()},
                        **{f"{p}|masks": np.packbits(v[2], axis=-1) for p, v in res.items()})
    print(name, W, H, round(sec, 2), {p: len(v[1]) for p, v in res.items()}, flush=True)

mem = dict(maxrss_gb=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e9)
if dev == "mps":
    mem["mps_driver_gb"] = torch.mps.driver_allocated_memory() / 1e9
    mem["mps_current_gb"] = torch.mps.current_allocated_memory() / 1e9
json.dump(dict(device=dev, dtype=a.dtype, prompts=prompts, threshold=a.threshold, load_s=load_s, n=len(times),
               sec_mean=float(np.mean(times)) if times else None, sec_median=float(np.median(times)) if times else None,
               mem=mem), open(os.path.join(a.out, "run.json"), "w"), indent=1)
print("done", len(times), "mean s", np.mean(times) if times else None, mem)
