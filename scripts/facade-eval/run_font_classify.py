"""Font classification for sign boxes, using the MIT ONNX model.

NEGATIVE RESULT — kept as evidence, do not adopt. See D7 in
FACADE_MODEL_DECISIONS.md. The model runs (302 signs in 15 s) but its output is
confidently wrong on real sign crops: on a clean 171x75 px sign it returns
`Redacted-Regular` at 73 % ("Redacted" is the font that renders as black censor
boxes), and the run's top families were `LibreBarcode39Extended`,
`AksaraBaliGalang`, `Khmer`, `Wavefont`, with negative logits. It is trained on
synthetic clean renders; ours are real 45-110 px crops. `fontClass` stays
'unknown'. For the styled-sign look, ask the local VLM one coarse question
(serif / sans / script / display) instead.

`storia/font-classify-onnx` is EfficientNet-B3 (timm `efficientnet_b3.ra2_in1k`)
finetuned on synthetic Google Fonts: input `[1,3,320,320]`, output 3,473 font
variants. Its licence is MIT, which is why it was chosen over `mixfont/lens`
(non-commercial only).

The model predicts a *font variant* (`AbhayaLibre-Bold`). Our sign schema wants a
*font class* (`serif | sans | script | display`), so the variant is reduced to a
family and looked up in `font-family-categories.json`, built from the public
Google Fonts metadata.

Usage (enrich a vision-ocr lane JSON in place):
  python run_font_classify.py --input=<vision.json> --out=<enriched.json> \
      [--model-dir=.cache/facade-eval/font-classify] [--top-k=3]
"""
import argparse
import json
import os
import re
import sys
import time

import numpy as np
import onnxruntime as ort
import yaml
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
INPUT_SIZE = 320


def load_classnames(model_dir):
    with open(os.path.join(model_dir, "model_config.yaml")) as handle:
        config = yaml.safe_load(handle)
    return list(config.get("classnames") or [])


def load_categories():
    with open(os.path.join(HERE, "font-family-categories.json")) as handle:
        return json.load(handle)["categories"]


def family_of(classname):
    """`AbhayaLibre-Bold` -> `AbhayaLibre`; `AROneSans[ARRR,wght]` -> `AROneSans`."""
    return re.split(r"[-[]", classname, maxsplit=1)[0]


def category_of(classname, categories):
    key = re.sub(r"[^A-Za-z0-9]", "", family_of(classname)).lower()
    return categories.get(key, "unknown")


def preprocess(image):
    resized = image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BICUBIC)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    array = (array - IMAGENET_MEAN) / IMAGENET_STD
    return np.transpose(array, (2, 0, 1))[None, ...].astype(np.float32)


def classify(session, classnames, categories, crop_path, box_px, top_k):
    image = Image.open(crop_path)
    left, top, width, height = (max(0, int(round(v))) for v in box_px)
    # pad a little so ascenders/descenders are not clipped by the OCR box
    pad_x, pad_y = max(2, int(width * 0.06)), max(2, int(height * 0.15))
    left, top = max(0, left - pad_x), max(0, top - pad_y)
    region = image.crop((left, top, min(image.width, left + width + 2 * pad_x), min(image.height, top + height + 2 * pad_y)))
    if region.width < 4 or region.height < 4:
        return []
    logits = session.run(None, {"input": preprocess(region)})[0][0]
    order = np.argsort(-logits)[:top_k]
    return [
        {
            "classname": classnames[index],
            "family": family_of(classnames[index]),
            "fontClass": category_of(classnames[index], categories),
            "score": float(logits[index]),
        }
        for index in order
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="vision-ocr lane JSON")
    parser.add_argument("--out", required=True)
    parser.add_argument("--model-dir", default=".cache/facade-eval/font-classify")
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    classnames = load_classnames(args.model_dir)
    categories = load_categories()
    session = ort.InferenceSession(os.path.join(args.model_dir, "model.onnx"), providers=["CPUExecutionProvider"])

    payload = json.load(open(args.input))
    started = time.time()
    classified = 0
    distribution = {}
    for record in payload.get("records", []):
        crop_path = record.get("cropFile")
        if not crop_path or not os.path.exists(crop_path):
            continue
        width_px, height_px = record.get("cropWidthPx"), record.get("cropHeightPx")
        wall_width, wall_height = record.get("wallWidthM"), record.get("wallHeightM")
        if not all([width_px, height_px, wall_width, wall_height]):
            continue
        for sign in record.get("signs", []):
            if args.limit and classified >= args.limit:
                break
            box = sign["boxWallM"]
            box_px = (
                (box["along"] / wall_width) * width_px,
                (1 - (box["up"] + box["height"]) / wall_height) * height_px,
                (box["width"] / wall_width) * width_px,
                (box["height"] / wall_height) * height_px,
            )
            try:
                matches = classify(session, classnames, categories, crop_path, box_px, args.top_k)
            except Exception as error:  # noqa: BLE001 - one bad sign must not stop the run
                sign["fontError"] = str(error)[:160]
                continue
            if not matches:
                continue
            sign["fontMatches"] = matches
            sign["fontFamily"] = matches[0]["family"]
            sign["fontClass"] = matches[0]["fontClass"]
            classified += 1
            distribution[matches[0]["fontClass"]] = distribution.get(matches[0]["fontClass"], 0) + 1
        if args.limit and classified >= args.limit:
            break

    payload["fontClassification"] = {
        "model": "storia/font-classify-onnx (EfficientNet-B3, MIT)",
        "categoriesFrom": "Google Fonts metadata",
        "signsClassified": classified,
        "fontClassDistribution": distribution,
        "secondsTotal": round(time.time() - started, 1),
    }
    with open(args.out, "w") as handle:
        json.dump(payload, handle, indent=1)
    print(json.dumps({"out": args.out, "signsClassified": classified, "distribution": distribution,
                      "secondsTotal": payload["fontClassification"]["secondsTotal"]}))


if __name__ == "__main__":
    sys.exit(main())
