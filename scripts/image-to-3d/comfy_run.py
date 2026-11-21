"""Run one image through a local ComfyUI server (no uploads anywhere else) and record time and peak memory.

    python -I comfy_run.py --server=127.0.0.1:8834 --comfy=<ComfyUI dir> --model=trellis2|pixal3d|hunyuan3d \
        --api=<trellis-pixal-api.json> --image=<png> --out=<dir> [--seed=42] [--upsample=1536] [--tex=4096]

trellis2 / pixal3d: the v0.46 template 3d_pixal3d_trellis2_image_to_model (converted by comfy_ui_to_api.py), its
PrimitiveBoolean switch picking the model; the outputs are saved with SaveGLB: textured.glb (UV-unwrapped, PBR
baked), painted.glb (vertex colours), coarse.glb (the 32^3 structure mesh).
hunyuan3d: Hunyuan3D 2.0 shape (Comfy native, shape only, no texture), as the 3d_hunyuan3d_image_to_model
subgraph, behind the same BiRefNet cut-out.
Peak memory: the server's phys_footprint (footprint -p, which counts Metal allocations), polled every 1 s.
"""
import json, os, shutil, subprocess, sys, threading, time, urllib.request

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
server, model, out = args["server"], args["model"], args["out"]
os.makedirs(out, exist_ok=True)
img_id = os.path.splitext(os.path.basename(args["image"]))[0]
shutil.copy(args["image"], os.path.join(args["comfy"], "input", f"i2d-{img_id}.png"))
prefix = f"i2d/{model}/{img_id}"
seed = int(args.get("seed", 42))

if model in ("trellis2", "pixal3d"):
    api = json.load(open(args["api"]))
    api["122"]["inputs"]["image"] = f"i2d-{img_id}.png"
    api["316"]["inputs"]["value"] = model == "trellis2"
    for k in ("3", "12", "18", "23"):
        api[k]["inputs"]["seed"] = seed
    if "upsample" in args:
        api["94"]["inputs"]["target_resolution"] = int(args["upsample"])
    if "tex" in args:
        api["288"]["inputs"]["value"] = int(args["tex"])
    api.pop("322", None)
    for name, src in (("textured", "285"), ("painted", "282"), ("coarse", "247")):
        api[f"save_{name}"] = {"class_type": "SaveGLB", "inputs": {"mesh": [src, 0], "filename_prefix": f"{prefix}-{name}"}}
else:
    api = {
        "1": {"class_type": "ImageOnlyCheckpointLoader", "inputs": {"ckpt_name": "hunyuan3d-dit-v2_fp16.safetensors"}},
        "2": {"class_type": "LoadImage", "inputs": {"image": f"i2d-{img_id}.png"}},
        "3": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}},
        "4": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["3", 0], "image": ["2", 0]}},
        "5": {"class_type": "ImageCropToMask", "inputs": {"images": ["2", 0], "masks": ["4", 0], "width": 1024, "height": 1024, "pad_factor": 1.1, "grow_mask": 0, "background": "#ffffff"}},
        "6": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["1", 1], "image": ["5", 0], "crop": "center"}},
        "7": {"class_type": "Hunyuan3Dv2Conditioning", "inputs": {"clip_vision_output": ["6", 0]}},
        "8": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 1.0}},
        "9": {"class_type": "EmptyLatentHunyuan3Dv2", "inputs": {"resolution": 3072, "batch_size": 1}},
        "10": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "seed": seed, "steps": 20, "cfg": 8.0, "sampler_name": "euler", "scheduler": "normal", "positive": ["7", 0], "negative": ["7", 1], "latent_image": ["9", 0], "denoise": 1.0}},
        "11": {"class_type": "VAEDecodeHunyuan3D", "inputs": {"samples": ["10", 0], "vae": ["1", 2], "num_chunks": 8000, "octree_resolution": 256}},
        "12": {"class_type": "VoxelToMesh", "inputs": {"voxel": ["11", 0], "algorithm": "surface net", "threshold": 0.6}},
        "13": {"class_type": "SaveGLB", "inputs": {"mesh": ["12", 0], "filename_prefix": f"{prefix}-shape"}},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["5", 0], "filename_prefix": f"{prefix}-cutout"}},
    }

pid = subprocess.run(["pgrep", "-f", f"--port {server.split(':')[1]}"], capture_output=True, text=True).stdout.split()[0]
peak, stop = [0], [False]


def poll():
    while not stop[0]:
        o = subprocess.run(["footprint", "-p", pid], capture_output=True, text=True).stdout
        for line in o.splitlines():
            if "phys_footprint:" in line:
                v, unit = line.split(":")[1].split()
                peak[0] = max(peak[0], float(v) * (1024 if unit == "GB" else 1 if unit == "MB" else 1 / 1024))
        time.sleep(1)


threading.Thread(target=poll, daemon=True).start()
t0 = time.time()
req = urllib.request.Request(f"http://{server}/prompt", data=json.dumps({"prompt": api}).encode(), headers={"Content-Type": "application/json"})
try:
    pr = json.load(urllib.request.urlopen(req))
except urllib.error.HTTPError as e:
    print(e.read().decode()[:3000]); raise SystemExit(1)
pid_prompt = pr["prompt_id"]
status = None
while True:
    time.sleep(2)
    h = json.load(urllib.request.urlopen(f"http://{server}/history/{pid_prompt}"))
    if pid_prompt in h:
        status = h[pid_prompt]["status"]
        break
stop[0] = True
dt = time.time() - t0
outdir = os.path.join(args["comfy"], "output", os.path.dirname(prefix))
files = sorted(f for f in os.listdir(outdir) if f.startswith(img_id + "-")) if os.path.isdir(outdir) else []
for f in files:
    shutil.copy(os.path.join(outdir, f), out)
msgs = [m for m in status.get("messages", []) if m[0] in ("execution_error",)]
rec = {"model": model, "image": args["image"], "seed": seed, "seconds": round(dt, 1), "peakFootprintMB": round(peak[0]), "status": status.get("status_str"),
       "files": files, "error": msgs[0][1].get("exception_message", "")[:2000] if msgs else None,
       "params": {k: args[k] for k in ("upsample", "tex") if k in args}}
json.dump(rec, open(os.path.join(out, "run.json"), "w"), indent=1)
print(json.dumps(rec))
