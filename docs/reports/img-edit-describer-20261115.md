# Image-edit de-tree describer pilot (2026-11-15/16)

**Question (David):** can a local image-edit model (Qwen-Image-Edit) take a street-panorama crop of a front that trees,
cars and bikes hide, remove the obstructions, fill in a plausible continuation, and give the describer a better read
than the occluded photo?

**Answer: no. Drop it.** The de-treed crops make the describer answer every field, but they answer it wrong more often
than the occluded photo does, and a blind check found that 10 of 17 renders show a materially different house. The
cheap baseline wins: every sampled front already has a leaf-off panorama capture, and reading that capture scores
89 % against the edit's 80 %. It costs one panorama fetch, not ten minutes of GPU time.

## Setup

| item | value |
|---|---|
| model | Qwen-Image-Edit-2511, 4-bit MLX via mflux 0.17.4 (`img_mod_linear` kept at 8-bit) |
| licence | Apache-2.0 (model and the Lightning LoRA) |
| speed-up | Qwen-Image-Edit-2511-Lightning-8steps-V1.0 LoRA (0.8 GB), 8 steps, guidance 1.0, applied as runtime adapters (`--no-bake-lora`: baking it into q4 keeps only 56 % of the update) |
| weights on disk | 25 GB (transformer 11 GB at q4, text encoder 14 GB at bf16, VAE 0.2 GB) under `~/.cache/img-edit-describer/weights/` |
| memory | the text encoder is quantized to 4-bit at load (`--te-bits 4`), and MLX's cache is capped at 2 GB. Peak is 21–23 GB. Without both changes the process grew to 36 GB and swapped the shared 48 GB Mac to 300 s per step. |
| resolution | long side 768 px; small crops are upscaled |
| runner | `scripts/img-edit-describer/edit_batch.py` loads the model once and resumes; the job list and prompts are in `prompts.json` |

## Test set

There are 20 fronts that trees, cars or bikes heavily hide: 10 in the Rivierenbuurt, 5 in Apollo and 5 in belt rows,
listed in `fronts.json`. For 17 of them a clear capture of the same front exists on another date, and that capture is
the ground truth. The generator never saw it. Truth crops come from the panorama API's other capture dates
(`crops-by-date.ts`). In a wider sample of 59 fronts, **59 of 59 have a leaf-off capture, and 44 of 59 have one that
is nearly free of foliage** (foliage share under 5 %).

## Method

- Every image went to a fresh opus reader as an opaque id in a shuffled set. The reader had the fixed prompt
  `describer-prompt.md` and 14 fields, and could answer `not-visible`.
- The sets were the occluded crops, the truth crops, a second read of the truth crops (the reader-noise ceiling), the
  17 edited "photo" renders and 6 edited "elevation" renders.
- `score.ts` scores each condition against the truth read.
- For the hallucination check, a separate fresh opus judge compared each render with its truth photo.

## Per-field accuracy (17 fronts with truth)

Accuracy is computed over the fields the reader answered; coverage is the share it answered.

| field | occluded | edit-photo | edit-elevation (6) | leaf-off truth re-read |
|---|---|---|---|---|
| storeys | 63 % (cov 50 %) | 63 % | 50 % | 63 % |
| roofStorey | 86 % (cov 47 %) | 80 % | 100 % | 93 % |
| bays | 50 % (cov 82 %) | **88 %** | 67 % | 82 % |
| windowKind | **87 %** | 65 % | 50 % | 76 % |
| windowHead | 100 % | 100 % | 83 % | 100 % |
| crown | 44 % (cov 60 %) | 73 % | 50 % | 43 % |
| wallColour | **81 %** | 59 % | 33 % | 94 % |
| finish | 100 % | 100 % | 50 % | 100 % |
| whiteFrames | 94 % | 94 % | 67 % | 100 % |
| entrances | 64 % | 53 % | 50 % | 94 % |
| erkers | 75 % | 71 % | 67 % | 100 % |
| balconies | 94 % | 94 % | 50 % | 100 % |
| dormers | 91 % (cov 65 %) | 82 % | 100 % | 100 % |
| shopfront | 100 % | 100 % | 100 % | 100 % |
| **all, over answered fields** | **83 %** (cov 81 %) | 80 % (cov 100 %) | 65 % | 90 % |
| **all, per field (not-visible counts as wrong)** | 67 % | 80 % | – | **89 %** |

On the 6 fronts that have all four conditions, the per-field scores are: occluded 68 %, edit-photo 81 %,
edit-elevation 65 % and leaf-off 87 %.

How to read this:

- **The edit's only gain is coverage.** The reader stops saying `not-visible` and answers everything, and on the
  fields it answers it is less accurate than on the occluded photo (80 % against 83 %).
- **Bays** improve, because the model regularises the window grid.
- **The crown gain is noise.** The truth photo re-read only agrees with itself 43 % of the time on crown, so the
  field is unreliable in every condition.
- **These fields get worse:**
  - Wall colour falls from 81 % to 59 %, because the render greys and darkens the brick.
  - Window kind falls from 87 % to 65 %.
  - Entrances fall from 64 % to 53 %.
- **The "cartoon / line elevation" variant is worse than the photo variant everywhere.** It throws away colour and
  finish, and it invents ornament and storeys.

## Hallucination check (17 photo renders against truth)

The fresh opus judge compared each render with its truth photo.

- **Verdicts: 0 faithful, 7 minor, 10 wrong.** A verdict of "wrong" means a describer would read a materially
  different house.
- **Windows:** 10 invented and 15 missing or merged. Eight of the missing are on one front, where a full-height erker
  was flattened.
- **Doors:** 2 invented and 0 missing.
- **Storeys:** 4 storey-count errors. Every one adds a storey: a light attic band or a tiled roof with dormers becomes
  a brick storey under an invented bracketed cornice.
- **Colour:** 6 colour or finish changes. Orange or yellow brick goes grey-brown, and once cream render becomes grey
  masonry.
- **Crown:** 10 crown or feature changes:
  - one bell/neck gable became a step gable;
  - dormers, French balconies and an erker were removed;
  - a row of top windows and a dormer gable were added.
- **Bays:** 0 bay-count changes.

The model keeps the regular rhythm of the window grid and invents exactly the things the house line cares most about:
the crown, the roof storey, the colour and the ornament. Under the provenance rule it could never be the only source of
a published field. Because it is confidently wrong on half the fronts, it should not even be a low-strength
`inferred` receipt.

## Cost

- **Per image:** median 564 s and mean 598 s (range 309–1205 s) for an 8-step Lightning edit at 768 px on this 48 GB
  Apple-silicon Mac, which was shared with the integration gate, browser lanes and another project's SAM3 job. An idle
  machine would probably be 2–3 times faster: 2 steps at 512 px took 107 s including the encode. Model load takes
  30–45 s.
- **City scale:** for an order of 100 k street fronts, 100 k × ~10 min is about 2 Mac-years on this shared machine, and
  roughly 0.5–1 Mac-year if the machine were dedicated to it. It would also hold about 23 GB of RAM for the whole run.
- **Leaf-off alternative:** one panorama fetch and crop per front from the existing per-date crop path. That is
  seconds of CPU and no GPU.

## Recommendation

1. **Drop the generative de-tree for describer reads.** The single field it helps, bays, is better taken from the
   leaf-off capture. Do not add generated-fill receipts.
2. **Adopt leaf-off capture selection.** Before reading a front, pick its least-foliage capture date. The
   `crops-by-date.ts` path computes a per-date foliage share and a leaf-off flag. Every sampled front had a leaf-off
   capture, and 75 % had one that is nearly clear. Fall back to the occluded read with honest `not-visible` answers.
   This is a cheap integration into the describer's crop step, and it belongs to the integrator or the describer lane.
3. If generative fill is ever revisited, two uses remain open. Neither was measured here.
   - A **texture-only** fill for the in-game facade bitmap, where likeness of the grid matters and the bays result is
     encouraging.
   - A larger or higher-bit model (q8 or bf16 on a bigger machine). The 4-bit renders have a blotchy, mottled
     surface.

## Artefacts

- **Code:** `scripts/img-edit-describer/` holds `crops-by-date.ts`, `edit_batch.py`, `describer-prompt.md`,
  `score.ts`, `sheet.sh`, `fronts.json` and `prompts.json`.
- **Work directory:** `~/.cache/img-edit-describer/work/` holds the inputs, the edited images, the blind sets, the
  reads, `key.json`, the hallucination key and `scores.md`.
- **Review sheets** (occluded | edit photo | edit elevation | leaf-off truth):
  `~/Code/map-recall2-worktrees/_pruned-sheets/img-edit-describer-20261115/<pandId>.jpg`. Three examples:
  - `0363100012105921`: a tree hides most of the front. The judge rated the render wrong: the attic under the deep eave
    became a full storey, the arched door became square-headed and the orange brick turned grey.
  - `0363100012176417`: the bays and storeys are right, but the bell/neck gable became a step gable.
  - `0363100012120343`: the judge rated it minor. The trees are gone and the grid and brick match, but the plain eave
    band gained an invented bracketed cornice.
