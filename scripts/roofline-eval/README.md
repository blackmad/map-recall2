# Roofline A1 — segmentation

`ROOFLINE_FROM_PHOTOS_PLAN.md` §0 task A1. Segments rectified facade strips into
the §4 label contract for the roofline pipeline (A2 consumes these masks).

Label contract (uint8 PNG, same size as the strip):

| value | meaning |
| --- | --- |
| 0 | other |
| 1 | sky |
| 2 | building (including roof) |
| 3 | occluder (vegetation, pole, traffic sign, vehicle, person) |
| 255 | unknown |

## Environment

Local inference only (Apple MPS or CPU); no hosted inference.

```bash
export ROOFLINE_CACHE=/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache
uv venv "$ROOFLINE_CACHE/roofline-eval/venv" --python 3.11
uv pip install --python "$ROOFLINE_CACHE/roofline-eval/venv/bin/python" -r scripts/roofline-eval/requirements.txt
```

## Model provenance (pinned)

| Item | Value |
| --- | --- |
| Hugging Face id | `facebook/mask2former-swin-large-mapillary-vistas-semantic` |
| Revision | `4772b6bf101d91f2534c106dc524d906aeb3c68a` |
| Weights file | `model.safetensors`, 865,964,336 bytes |
| **Weights sha256** | `72721afb6894c0b1239b9259c428996d9ca0aecbebc4efb4a2deaae0403e2ea7` |
| `config.json` sha256 | `b40bec8d82de3b53ef967dce0496c37de520b69466f1a8d2f6c035700cbae9f3` |
| `preprocessor_config.json` sha256 | `a76f8cc9f21f1e4152d8824338d9231d823c2426eedf06b77fa6790889206987` |
| Class order | Mapillary Vistas, 65 classes (`config.json` `id2label`) |

The checkpoint's missing `...encoder.swin.layernorm.{weight,bias}` is harmless:
`torch.nn.LayerNorm` initialises to weight 1 / bias 0, so the missing final norm
is an identity, and the used per-stage norms (`hidden_states_norms`) do load.

Class mapping (in `segment.py`, written into `provenance.json`): Vistas
`Building`(17) and `Wall`(6) → 2; `Sky`(27) → 1; `Vegetation`(30), `Pole`(45),
`Utility Pole`(47), `Traffic Light`(48), traffic-sign frame/back/front
(46/49/50), `Person`(19), animals, riders and all vehicles (52–64) → 3;
everything else → 0. Vistas has **no wire class**, so wires are not forced to
`3` and fall through to the model's prediction (often sky or building).

## Run

Strips default to the existing 91-strip set (90 JPEGs + `manifest.json`); point
`--strips` at `strips-roofline-v1` once A0 lands.

```bash
VENV="$ROOFLINE_CACHE/roofline-eval/venv/bin/python"
# S1 Mask2Former, tiled (long side never squashed below --long-side px)
"$VENV" scripts/roofline-eval/segment.py --method s1 \
  --out "$ROOFLINE_CACHE/roofline-eval"

# S2 baseline: convert existing amsterdam-facade/2 masks, no inference
"$VENV" scripts/roofline-eval/segment.py --method af2 \
  --af2-dir .../facade-photo-review/local/expansion-01 \
  --af2-dir .../facade-photo-review/local/pilot-01 \
  --out "$ROOFLINE_CACHE/roofline-eval"
```

Masks land in `$ROOFLINE_CACHE/roofline-eval/masks/<method>/`, record per-strip
obliquity (from the strip manifest), timings and the class mapping in
`s1.provenance.json` / `af2.provenance.json`.

Contact sheets:

```bash
"$VENV" scripts/roofline-eval/contact-sheet.py \
  --strips <strips> \
  --masks-s1 "$ROOFLINE_CACHE/roofline-eval/masks/s1" \
  --masks-af2 "$ROOFLINE_CACHE/roofline-eval/masks/af2" \
  --out "$ROOFLINE_CACHE/roofline-eval/contact-sheets"
```

## Tiling

The processor's native input is 384×384, which would squash a whole strip. Each
tile is instead aspect-preserving resized so its long side is `--long-side`
(default 1024), edge-padded to a multiple of 32, run, then the label map is
mapped back to the tile. Tiles of `--tile-long` (1024) with `--tile-overlap`
(128) px are stitched first-write-wins. Strips wider than 1024 px get a second
tile (one strip of 90 does).
