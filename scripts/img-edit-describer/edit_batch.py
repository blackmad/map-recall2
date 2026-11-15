"""Image-edit describer pilot: run Qwen-Image-Edit-2511 (mflux, MLX) over a job list with the model loaded once.

    ~/.cache/img-edit-describer/venv/bin/python -I scripts/img-edit-describer/edit_batch.py jobs.json \
        --model ~/.cache/img-edit-describer/weights/qwen-edit-2511/q4 [--lora <lightning.safetensors>] [--steps 8]

jobs.json: [{"input": "...jpg", "prompt": "...", "output": "...png", "seed": 1}]. Existing outputs are skipped (resumable).
Prints and appends seconds per image to <output>.json beside each output.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

from mflux.models.qwen.cli.qwen_image_edit_generate import QwenImageEditCommand, build_parser


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs")
    ap.add_argument("--model", required=True)
    ap.add_argument("--lora", default=None)
    ap.add_argument("--lora-scale", type=float, default=1.0)
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--guidance", type=float, default=1.0)
    ap.add_argument("--max-side", type=int, default=1024)
    a = ap.parse_args()
    jobs = json.load(open(a.jobs))
    todo = [j for j in jobs if not os.path.exists(j["output"])]
    print(f"{len(todo)} of {len(jobs)} jobs to run", flush=True)
    if not todo:
        return
    argv = ["--model", a.model, "--base-model", "qwen-image-edit-2511", "--prompt", "x", "--image-paths", todo[0]["input"],
            "--steps", str(a.steps), "--guidance", str(a.guidance)]
    if a.lora:
        argv += ["--lora-paths", a.lora, "--lora-scales", str(a.lora_scale)]
    args = build_parser().parse_args(argv)
    t0 = time.time()
    model = QwenImageEditCommand.load(args)
    print(f"load {time.time() - t0:.1f} s", flush=True)
    from PIL import Image
    for j in todo:
        w, h = Image.open(j["input"]).size
        s = min(1.0, a.max_side / max(w, h))
        # Multiples of 16, aspect kept.
        args.width, args.height = max(256, int(w * s) // 16 * 16), max(256, int(h * s) // 16 * 16)
        args.image_paths = [j["input"]]
        t = time.time()
        img = QwenImageEditCommand.generate(model, args, int(j.get("seed", 1)), j["prompt"])
        Path(j["output"]).parent.mkdir(parents=True, exist_ok=True)
        img.save(path=Path(j["output"]), export_json_metadata=False)
        dt = time.time() - t
        json.dump({"seconds": round(dt, 1), "width": args.width, "height": args.height, "steps": a.steps, "lora": a.lora, "prompt": j["prompt"]},
                  open(j["output"] + ".json", "w"))
        print(f"{dt:.1f} s  {args.width}x{args.height}  {j['output']}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
