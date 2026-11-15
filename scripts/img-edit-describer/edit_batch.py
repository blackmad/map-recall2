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
    ap.add_argument("--te-bits", type=int, default=0,
                    help="quantize the bf16 text encoder (14 GB) after load; 8 brings it to ~7.5 GB on a busy 48 GB Mac")
    ap.add_argument("--no-bake-lora", action="store_true", help="keep the LoRA as runtime adapters (baking into q4 keeps ~56 %% of it)")
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
        if a.no_bake_lora:
            argv += ["--no-bake-lora"]
    sys.argv = ["mflux-generate-qwen-edit"] + argv  # mflux's parser reads sys.argv only
    args = build_parser().parse_args()
    t0 = time.time()
    model = QwenImageEditCommand.load(args)
    if a.te_bits:
        import mlx.core as mx
        import mlx.nn as nn
        nn.quantize(model.text_encoder, bits=a.te_bits, class_predicate=lambda p, m: hasattr(m, "to_quantized"))
        mx.eval(model.text_encoder.parameters())
        mx.clear_cache()
    print(f"load {time.time() - t0:.1f} s", flush=True)
    from PIL import Image
    for j in todo:
        w, h = Image.open(j["input"]).size
        s = a.max_side / max(w, h)  # upscale small crops too: the model works at ~1 MP
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
