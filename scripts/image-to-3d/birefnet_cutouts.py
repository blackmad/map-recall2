"""BiRefNet cut-outs (the TRELLIS.2/Pixal3D template's own background removal) through the local ComfyUI server.

    python -I birefnet_cutouts.py --server=127.0.0.1:8834 --comfy=<ComfyUI dir> --inputs=<dir of png> --out=<dir>
Writes <out>/<id>.png as RGBA (alpha = the BiRefNet mask), for TripoSR's --cutout."""
import json, os, shutil, sys, time, urllib.request
from PIL import Image
args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
os.makedirs(args["out"], exist_ok=True)
for f in sorted(os.listdir(args["inputs"])):
    if not f.endswith(".png"):
        continue
    k = f[:-4]
    shutil.copy(os.path.join(args["inputs"], f), os.path.join(args["comfy"], "input", f"i2d-{k}.png"))
    api = {"1": {"class_type": "LoadImage", "inputs": {"image": f"i2d-{k}.png"}},
           "2": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}},
           "3": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["2", 0], "image": ["1", 0]}},
           "4": {"class_type": "MaskToImage", "inputs": {"mask": ["3", 0]}},
           "5": {"class_type": "SaveImage", "inputs": {"images": ["4", 0], "filename_prefix": f"i2d/mask/{k}"}}}
    req = urllib.request.Request(f"http://{args['server']}/prompt", data=json.dumps({"prompt": api}).encode(), headers={"Content-Type": "application/json"})
    pid = json.load(urllib.request.urlopen(req))["prompt_id"]
    while True:
        time.sleep(1)
        h = json.load(urllib.request.urlopen(f"http://{args['server']}/history/{pid}"))
        if pid in h:
            break
    img = h[pid]["outputs"]["5"]["images"][0]
    mask = Image.open(os.path.join(args["comfy"], "output", img["subfolder"], img["filename"])).convert("L")
    rgb = Image.open(os.path.join(args["inputs"], f)).convert("RGB")
    rgb.putalpha(mask.resize(rgb.size))
    rgb.save(os.path.join(args["out"], f))
    print(k, h[pid]["status"]["status_str"])
