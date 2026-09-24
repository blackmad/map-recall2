#!/usr/bin/env python3
"""Roofline task A1 contact sheets.

Renders the strips and their §4 masks into inspectable PNGs (no model runs):

  contact-sheet-strips.png       every strip, with the s1 mask as a colour wash
  contact-sheet-vistas-vs-af2.png  the buildings that have both a s1 (Vistas) and
                                   an af2 mask: strip, s1, af2, and a disagreement
                                   map with the per-class agreement

Colours (contract): 0 other grey · 1 sky blue · 2 building red · 3 occluder green
· 255 unknown yellow.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

CONTRACT_COLOURS = {
    0: (128, 128, 128),
    1: (76, 150, 255),
    2: (232, 66, 66),
    3: (66, 200, 82),
    255: (240, 220, 40),
}
BG = (24, 24, 28)
FG = (235, 235, 235)


def overlay(rgb: np.ndarray, mask: np.ndarray, alpha: float = 0.55) -> np.ndarray:
    out = rgb.copy()
    for value, colour in CONTRACT_COLOURS.items():
        sel = mask == value
        if sel.any():
            out[sel] = ((1 - alpha) * rgb[sel] + alpha * np.array(colour)).astype(np.uint8)
    return out


def fit_height(arr: np.ndarray, height: int) -> np.ndarray:
    h, w = arr.shape[:2]
    width = max(1, round(w * height / h))
    return np.array(Image.fromarray(arr).resize((width, height), Image.Resampling.LANCZOS))


def agreement_map(rgb: np.ndarray, s1: np.ndarray, af2: np.ndarray) -> tuple[np.ndarray, dict]:
    disagree = s1 != af2
    out = (0.35 * rgb).astype(np.uint8)
    out[~disagree] = (0.55 * rgb[~disagree]).astype(np.uint8)
    out[disagree] = (255, 0, 200)
    summary = {
        "pixelAgreement": round(float((~disagree).mean()), 4),
        "s1ClassShare": {str(v): round(float((s1 == v).mean()), 4) for v in CONTRACT_COLOURS},
        "af2ClassShare": {str(v): round(float((af2 == v).mean()), 4) for v in CONTRACT_COLOURS},
        "disagreementByPair": {},
    }
    pairs: dict[str, int] = {}
    for a, b in zip(s1[disagree].tolist(), af2[disagree].tolist()):
        key = f"s1={a}->af2={b}"
        pairs[key] = pairs.get(key, 0) + 1
    total = int(disagree.sum()) or 1
    summary["disagreementByPair"] = {
        k: round(v / total, 4) for k, v in
        sorted(pairs.items(), key=lambda kv: -kv[1])[:8]}
    return out, summary


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strips", type=Path, required=True)
    ap.add_argument("--masks-s1", type=Path, required=True)
    ap.add_argument("--masks-af2", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--thumb-height", type=int, default=150)
    ap.add_argument("--columns", type=int, default=12)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    jpgs = sorted(p for p in args.strips.iterdir()
                  if p.suffix.lower() in (".jpg", ".jpeg", ".png")
                  and not p.name.endswith(".mask.png"))

    # --- all strips, s1 overlay ------------------------------------------------
    th = args.thumb_height
    pad = 8
    label_h = 14
    thumbs = []
    for jpg in jpgs:
        mask_path = args.masks_s1 / (jpg.stem + ".mask.png")
        rgb = np.array(Image.open(jpg).convert("RGB"))
        if mask_path.exists():
            mask = np.array(Image.open(mask_path))
            rgb = overlay(rgb, mask)
        t = fit_height(rgb, th)
        thumbs.append((t, jpg.stem))
    cell_w = max(t.shape[1] for t, _ in thumbs) + pad
    cell_h = th + label_h + pad
    cols = args.columns
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w + pad, rows * cell_h + pad), BG)
    draw = ImageDraw.Draw(sheet)
    for i, (t, stem) in enumerate(thumbs):
        r, c = divmod(i, cols)
        x = pad + c * cell_w + (cell_w - pad - t.shape[1]) // 2
        y = pad + r * cell_h
        sheet.paste(Image.fromarray(t), (x, y))
        draw.text((pad + c * cell_w, y + th + 1), stem.split("__")[0][:26], fill=FG)
    strips_png = args.out / "contact-sheet-strips.png"
    sheet.save(strips_png)
    print("wrote", strips_png, sheet.size)

    # --- Vistas vs af2 on the buildings that have both -------------------------
    rows_data = []
    order = []
    strip_by_stem = {p.stem: p for p in jpgs}
    for mask_path in sorted(args.masks_af2.glob("*.mask.png")):
        stem = mask_path.name[: -len(".mask.png")]
        if stem in strip_by_stem:
            order.append(stem)

    comparisons = {}
    cells = []
    row_h = 220
    for stem in order:
        rgb = np.array(Image.open(strip_by_stem[stem]).convert("RGB"))
        s1 = np.array(Image.open(args.masks_s1 / f"{stem}.mask.png"))
        af2 = np.array(Image.open(mask_path := args.masks_af2 / f"{stem}.mask.png"))
        diff, summary = agreement_map(rgb, s1, af2)
        comparisons[stem] = summary
        cells.append((
            fit_height(rgb, row_h),
            fit_height(overlay(rgb, s1), row_h),
            fit_height(overlay(rgb, af2), row_h),
            fit_height(diff, row_h),
        ))
    if cells:
        widths = [max(c[i].shape[1] for c in cells) for i in range(4)]
        gap, header = 10, 22
        total_w = sum(widths) + gap * 5
        total_h = header + len(cells) * (row_h + 26) + gap
        sheet2 = Image.new("RGB", (total_w, total_h), BG)
        draw = ImageDraw.Draw(sheet2)
        heads = ["strip", "s1 (Vistas) mask", "af2 mask", "disagreement (magenta)"]
        x = gap
        for w, head in zip(widths, heads):
            draw.text((x, 4), head, fill=FG)
            x += w + gap
        for r, (cell, stem) in enumerate(zip(cells, order)):
            y = header + r * (row_h + 26)
            x = gap
            for i, im in enumerate(cell):
                sheet2.paste(Image.fromarray(im), (x, y))
                x += widths[i] + gap
            s = comparisons[stem]
            draw.text((gap, y + row_h + 2),
                      f"{stem.split('__')[0]}  agree={s['pixelAgreement']:.1%}", fill=FG)
        vs_png = args.out / "contact-sheet-vistas-vs-af2.png"
        sheet2.save(vs_png)
        print("wrote", vs_png, sheet2.size)

    (args.out / "vistas-vs-af2.json").write_text(
        json.dumps({"schemaVersion": 1, "task": "roofline-A1",
                    "note": "Per-building pixel agreement between the s1 (Mapillary "
                            "Vistas) and af2 (amsterdam-facade/2) contract masks.",
                    "buildings": comparisons}, indent=2) + "\n")
    print("wrote", args.out / "vistas-vs-af2.json")


if __name__ == "__main__":
    main()
