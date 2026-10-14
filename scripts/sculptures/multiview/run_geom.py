"""Feed-forward multi-view geometry (VGGT or MapAnything) on unposed photos; writes a points + cameras npz.

  <venv>/bin/python -I run_geom.py --model=vggt|mapanything --out=<dir> --list=<views.txt> [--device=mps|cpu]

views.txt: one image path per line. Output `<out>/geom.npz`: per view
  pts (N,H,W,3) world points, conf (N,H,W), rgb (N,H,W,3) uint8, cam2world (N,4,4) OpenCV convention,
  K (N,3,3) at the network resolution, names, plus timing.json.
VGGT weights: facebook/VGGT-1B (CC BY-NC 4.0). MapAnything weights: facebook/map-anything-apache (Apache 2.0).
"""
import json, os, sys, time
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
import numpy as np
import torch

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
out = args["out"]; os.makedirs(out, exist_ok=True)
paths = [l.strip() for l in open(args["list"]) if l.strip() and not l.startswith("#")]
dev = torch.device(args.get("device", "mps" if torch.backends.mps.is_available() else "cpu"))
timing = {"model": args["model"], "device": str(dev), "views": len(paths)}
t0 = time.time()
if args["model"] == "vggt":
    sys.path.insert(0, args.get("src", "src"))
    from vggt.models.vggt import VGGT
    from vggt.utils.load_fn import load_and_preprocess_images
    from vggt.utils.pose_enc import pose_encoding_to_extri_intri
    from vggt.utils.geometry import unproject_depth_map_to_point_map
    model = VGGT.from_pretrained(args.get("weights", "facebook/VGGT-1B")).to(dev).eval()
    timing["loadS"] = round(time.time() - t0, 1); t0 = time.time()
    images = load_and_preprocess_images(paths).to(dev)
    with torch.no_grad():
        dtype = torch.float16 if dev.type == "mps" and args.get("half") else torch.float32
        with torch.autocast(device_type=dev.type, dtype=dtype, enabled=dtype != torch.float32):
            pred = model(images)
    extr, intr = pose_encoding_to_extri_intri(pred["pose_enc"], images.shape[-2:])
    extr, intr = extr[0].float().cpu().numpy(), intr[0].float().cpu().numpy()
    depth = pred["depth"][0].float().cpu().numpy()
    conf = pred["depth_conf"][0].float().cpu().numpy()
    pts = unproject_depth_map_to_point_map(depth, extr, intr)
    rgb = (images.permute(0, 2, 3, 1).cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
    c2w = np.tile(np.eye(4), (len(paths), 1, 1))
    R, t = extr[:, :3, :3], extr[:, :3, 3]
    c2w[:, :3, :3] = R.transpose(0, 2, 1); c2w[:, :3, 3] = -np.einsum("nji,nj->ni", R, t)
    K = intr
else:
    from mapanything.models import MapAnything
    from mapanything.utils.image import load_images
    model = MapAnything.from_pretrained(args.get("weights", "facebook/map-anything-apache")).to(dev).eval()
    timing["loadS"] = round(time.time() - t0, 1); t0 = time.time()
    views = load_images(paths)
    with torch.no_grad():
        preds = model.infer(views, memory_efficient_inference=True, use_amp=dev.type != "mps", apply_mask=True, mask_edges=True)
    pts = np.stack([p["pts3d"][0].float().cpu().numpy() for p in preds])
    conf = np.stack([p["conf"][0].float().cpu().numpy() for p in preds])
    rgb = np.stack([(p["img_no_norm"][0].float().cpu().numpy() * 255).clip(0, 255).astype(np.uint8) for p in preds])
    c2w = np.stack([p["camera_poses"][0].float().cpu().numpy() for p in preds])
    K = np.stack([p["intrinsics"][0].float().cpu().numpy() for p in preds])
    mask = np.stack([p["mask"][0].squeeze(-1).cpu().numpy() for p in preds]) if "mask" in preds[0] else None
    if mask is not None:
        conf = np.where(mask > 0, conf, 0)
    timing["metricScale"] = [float(p["metric_scaling_factor"].flatten()[0]) for p in preds][:1]
timing["inferS"] = round(time.time() - t0, 1)
timing["pointsShape"] = list(pts.shape)
np.savez_compressed(os.path.join(out, "geom.npz"), pts=pts.astype(np.float32), conf=conf.astype(np.float32), rgb=rgb,
                    cam2world=c2w.astype(np.float64), K=K, names=np.array(paths))
json.dump(timing, open(os.path.join(out, "timing.json"), "w"), indent=1)
print(json.dumps(timing))
