# Local image-to-3D on canal-belt fronts and landmark ornaments (2026-11-21)

Research lane `lane/tripo-ornaments-20261121`. Nothing here is installed in the game.
Everything ran locally on the M4 Pro (48 GB, MPS). There were no uploads and no hosted APIs.

## Headline

**The blind judge preferred the model to today on all 12 ornament sheets from TripoSR (both cut-outs) and Hunyuan3D. TRELLIS.2 won only 2 of 4 ornaments. On fronts, no model is reliable: the best scored 3 better, 1 same and 2 worse out of six.**

Blind verdicts, model against today (Opus, one judge, 40 sheets, unblinded afterwards):

| model | fronts (6): better / same / worse | ornaments (4): better / worse | time per input | texture |
|---|---|---|---|---|
| TripoSR, rembg cut-out (as shipped) | 0 / 0 / 6 | 4 / 0 | 16–29 s | vertex colour |
| TripoSR, BiRefNet cut-out | 3 / 0 / 3 | 4 / 0 | 10–16 s | vertex colour |
| TRELLIS.2 (ComfyUI native, int8) | 3 / 0 / 3 | 2 / 2 | 4.5–52 min (machine loaded) | PBR texture set |
| Hunyuan3D 2.0 (ComfyUI native, shape only) | 3 / 1 / 2 | 4 / 0 | 5–8 min | none (grey) |
| Pixal3D | skipped: disk cap | | | |
| Hi3D | skipped: CUDA-only, no mesh stage in the repo | | | |

Read this with one caveat: "today" for the ornaments is weak. On this set the HMDH bust is a stacked
primitive, the cartouche is a plain slab, and the gable top is a triangle. Beating today is therefore a
low bar for ornaments.

The front "wins" were the three wide, symmetric stone/stucco fronts the kit draws badly (H54, K604, and
H38's step gable). Every model lost on narrow brick fronts that the kit already draws plausibly.

## Test set

All inputs are open data: Gemeente Amsterdam street panoramas from 2024–25, rectified. Provenance is in `artifacts/image-to-3d/inputs/inputs.json`.

| id | subject | source |
|---|---|---|
| front-h-28 | Herengracht 28 (pand 0363100012179837) | belt-review rectified crop, pano 2024-12-03 |
| front-h-36 | Herengracht 36 (0363100012179684) | belt-review rectified crop |
| front-h-38 | Herengracht 38 (0363100012179671) | belt-review rectified crop |
| front-h-54 | Herengracht 54 (0363100012169218) | belt-review rectified crop, 2025-06-16 |
| front-k-604 | Keizersgracht 604 (0363100012176068) | belt-review rectified crop |
| front-k-632 | Keizersgracht 632 (0363100012176751) | belt-review rectified crop |
| orn-relief-hoofdbureau | coat-of-arms relief, Hoofdbureau Elandsgracht | pano b_20241216_0911_Track04_Sphere_00318, aimed pinhole view |
| orn-figure-hmdh-bust | bust (figure), Huis met de Hoofden | pano recording_2025-06-16_03-46-32_01696 |
| orn-cartouche-hmdh | cartouche, Huis met de Hoofden | same pano |
| orn-gabletop-stationsplein | carved gable top, Stationsplein pavilions | pano recording_2025-06-16_06-42-40_02699 |

The set has six Herengracht/Keizersgracht fronts and four ornaments, as the brief asked. "Today" means:

- **Fronts:** the game's generic house render (`npm run house:preview -- <pand> --threeq`).
- **Ornaments:** the installed hand-modelled landmark GLB, rendered from the panorama pose.

## Method

**Pipelines**

- TripoSR ran through the repo's `scripts/sculptures/run_triposr.py` with two cut-out variants: rembg/u2net as shipped, and a BiRefNet cut-out.
- TRELLIS.2 and Hunyuan3D 2.0 ran through ComfyUI v0.46.0 native nodes (`scripts/image-to-3d/comfy_run.py`).

**Placement**

- Every output GLB is scaled to real size:
  - fronts to the game's building top height (`measure.json heights.topM`);
  - ornaments to the crop height × the view's m/px.
- Each model was rendered square-on and from a 35° oblique with the repo's Node GLB raster (`scripts/image-to-3d/place-render.ts`).
- Fronts are checked against the BAG wall length (`widthErrorPct`).

**Blind judging**

- Each sheet shows photo | A | B, with the front view on top and the oblique below.
- Which side is today and which is the model is shuffled per sheet with a seeded RNG. The key is in `artifacts/image-to-3d/blind/key.json`.
- One fresh Opus judge, who never saw the key, gave an absolute verdict per sheet (brief: `scripts/image-to-3d/judge-brief.md`).
- Verdicts below are unblinded: "better" means the model beat today.

**Timing and memory**

- Times are wall-clock per input, including model load.
- Peak memory is the process phys_footprint: `/usr/bin/time -l` for TripoSR, and `footprint` polled each second on the ComfyUI server for the others.
- Other lanes loaded the machine heavily for most TRELLIS.2 runs (load average 150–440, with swap), so those times are pessimistic.
- The machine crashed and rebooted at 17:46, mid-batch. The runs resumed after the reboot.

## Results

| model | input | time s | peak GB | tris | texture | depth/w | w err % | blind verdict (front / oblique) | model failure modes (judge) |
|---|---|---|---|---|---|---|---|---|---|
| TripoSR (rembg) | front-h-28 | 24.5 | 7.7 | 84,838 | vc | 1.666 | -22.8 | **worse** (worse / worse) | melted surfaces, missing third bay, deep box, blurry gable, ragged base |
| TripoSR (rembg) | front-h-36 | 28.5 | 6.9 | 78,676 | vc | 1.1 | -7.9 | **worse** (worse / worse) | holes, missing top/dormer, detached chunk, melted |
| TripoSR (rembg) | front-h-38 | 21.3 | 7.5 | 65,016 | vc | 0.646 | 94.8 | **worse** (worse / worse) | garbage geometry, no facade, spike artifact |
| TripoSR (rembg) | front-h-54 | 16.5 | 7.1 | 77,506 | vc | 0.392 | 105.6 | **worse** (worse / worse) | fragment only, most of facade missing, melted |
| TripoSR (rembg) | front-k-604 | 17.2 | 7.0 | 53,852 | vc | 0.405 | 357.1 | **worse** (worse / worse) | only a melted cornice strip, facade missing |
| TripoSR (rembg) | front-k-632 | 24.6 | 7.0 | 63,962 | vc | 0.983 | 14.3 | **worse** (worse / worse) | melted, gable broken, left edge missing, dark colour |
| TripoSR (rembg) | orn-cartouche-hmdh | 20.5 | 6.9 | 87,932 | vc | 0.264 | 30.9 | **better** (better / better) | soft/melted scrolls, greenish grey, crest on top missing |
| TripoSR (rembg) | orn-figure-hmdh-bust | 18.4 | 7.0 | 88,824 | vc | 0.652 | 22.3 | **better** (better / better) | soft surfaces, plinth missing, cornice chunk through the neck, blue tint |
| TripoSR (rembg) | orn-gabletop-stationsplein | 19.9 | 6.9 | 129,424 | vc | 0.69 | 56.7 | **better** (better / better) | dull grey-green colour, ragged edges, triangular fin artifact on the right |
| TripoSR (rembg) | orn-relief-hoofdbureau | 23.5 | 6.8 | 84,084 | vc | 0.422 | -33.3 | **better** (better / better) | dark brown instead of pale stone, blobby, ribbon truncated, no wall |
| TripoSR (BiRefNet cut-out) | front-h-28 | 16.1 | 7.1 | 125,508 | vc | 1.05 | 5.7 | **worse** (same / worse) | melted surfaces, deep box, blurry openings, lumpy gable shoulders |
| TripoSR (BiRefNet cut-out) | front-h-36 | 12.8 | 7.2 | 103,060 | vc | 0.995 | 13.6 | **worse** (worse / worse) | melted, box deep, dark, blurry windows, uneven top |
| TripoSR (BiRefNet cut-out) | front-h-38 | 13.0 | 6.7 | 79,720 | vc | 1.191 | -14.3 | **better** (better / worse) | spurious pole on the left, blurry, deep box in oblique, ragged base |
| TripoSR (BiRefNet cut-out) | front-h-54 | 13.1 | 6.6 | 374,376 | vc | 1.028 | 2.1 | **better** (better / better) | dark blue-grey instead of light render, soft detail, somewhat deep |
| TripoSR (BiRefNet cut-out) | front-k-604 | 11.3 | 6.7 | 435,272 | vc | 1.13 | 2.7 | **better** (better / better) | three spike artifacts on roof, soft melted detail, stoop smeared |
| TripoSR (BiRefNet cut-out) | front-k-632 | 10.0 | 6.5 | 67,618 | vc | 0.47 | 81.8 | **worse** (worse / worse) | missing most of the facade, floating window block, no gable |
| TripoSR (BiRefNet cut-out) | orn-cartouche-hmdh | 11.9 | 6.4 | 68,628 | vc | 0.566 | -3.6 | **better** (better / better) | soft scrolls, grey-green tint, spur at bottom right |
| TripoSR (BiRefNet cut-out) | orn-figure-hmdh-bust | 16.0 | 6.4 | 108,572 | vc | 1.046 | -7.4 | **better** (better / better) | soft, blue tint, back slab visible in oblique, cornice chunk across the neck |
| TripoSR (BiRefNet cut-out) | orn-gabletop-stationsplein | 10.4 | 6.4 | 132,916 | vc | 0.839 | 11.8 | **better** (better / better) | dull colours, soft detail, cartouche blurred |
| TripoSR (BiRefNet cut-out) | orn-relief-hoofdbureau | 10.3 | 6.4 | 39,786 | vc | 0.217 | 3.8 | **better** (better / better) | dark brown instead of pale stone, no wall, stray wire artifact |
| TRELLIS.2 int8 | front-h-28 ¹ | 3101.4 | 15.0 | 699,992 | PBR 3× | 0.045 | 88.2 | **worse** (worse / worse) | featureless dark slab, no gable, no windows, smeared texture |
| TRELLIS.2 int8 | front-h-36 | 872.5 | 13.0 | 699,976 | PBR 3× | 0.092 | 7.7 | **better** (better / better) | too dark/grey instead of brown brick, cornice dull, uneven base |
| TRELLIS.2 int8 | front-h-38 | 1530.4 | 13.0 | 698,906 | PBR 3× | 3.157 | -28.3 | **worse** (worse / worse) | black textured box, no gable, no openings, deep block |
| TRELLIS.2 int8 | front-h-54 | 1332.1 | 14.0 | 699,940 | PBR 3× | 0.257 | 6.1 | **better** (better / better) | too dark vs the light render, a few holes/white specks |
| TRELLIS.2 int8 | front-k-604 | 640.7 | 19.0 | 699,800 | PBR 3× | 0.74 | 21.2 | **better** (better / better) | too dark/brown, hoist beams stick out of the roof, open side in oblique |
| TRELLIS.2 int8 | front-k-632 | 305.5 | 18.0 | 699,880 | PBR 3× | 0.288 | 0.2 | **worse** (worse / worse) | holes between storeys, gable fragmentary, dark colour, missing parts |
| TRELLIS.2 int8 | orn-cartouche-hmdh | 271.3 | 18.0 | 699,976 | PBR 3× | 0.071 | 283.6 | **better** (better / better) | wide plaque wrong proportions, cartouche too small, extra diamonds outside the shield, grey not buff |
| TRELLIS.2 int8 | orn-figure-hmdh-bust | 864.0 | 18.0 | 699,694 | PBR 3× | 0.412 | 111.7 | **better** (better / better) | faces front instead of profile, blue tint instead of white stone, wide invented entablature |
| TRELLIS.2 int8 | orn-gabletop-stationsplein | 639.2 | 18.0 | 699,956 | PBR 3× | 0.023 | 58.3 | **worse** (worse / worse) | no shape at all, dark smeared texture, flat panel |
| TRELLIS.2 int8 | orn-relief-hoofdbureau | 301.6 | 18.0 | 700,000 | PBR 3× | 0.002 | 23.3 | **worse** (worse / worse) | flat slab, no silhouette, smeared dark texture, no depth |
| Hunyuan3D 2.0 (shape) | front-h-28 | 374.1 | 21.0 | 236,844 | none | 0.868 | 3.4 | **same** (better / worse) | untextured grey, window openings barely read, box too deep, lumpy gable top and debris at base |
| Hunyuan3D 2.0 (shape) | front-h-36 | 353.0 | 21.0 | 158,186 | none | 0.194 | 6.1 | **worse** (worse / worse) | no colour, openings unreadable, melted panel detail, missing balcony, ragged base |
| Hunyuan3D 2.0 (shape) | front-h-38 | 376.7 | 18.0 | 304,026 | none | 0.897 | -11.9 | **better** (better / worse) | untextured grey, huge spurious flat slab on the left visible in oblique, lump at base |
| Hunyuan3D 2.0 (shape) | front-h-54 | 421.0 | 20.0 | 615,308 | none | 0.356 | 11.3 | **better** (better / better) | untextured (though grey is near the light stone), slightly wavy surfaces |
| Hunyuan3D 2.0 (shape) | front-k-604 | 407.1 | 21.0 | 540,296 | none | 0.589 | 22.3 | **better** (better / better) | untextured grey, hoist-beam stubs and a loose slab on the roof, debris at base |
| Hunyuan3D 2.0 (shape) | front-k-632 | 350.9 | 22.0 | 208,706 | none | 0.099 | 10.5 | **worse** (worse / worse) | untextured, gable top missing/cut flat, openings barely read, ragged edges, a hole |
| Hunyuan3D 2.0 (shape) | orn-cartouche-hmdh | 2708.5 | 19.0 | 217,222 | none | 0.636 | -20 | **better** (better / better) | untextured, no red diamonds, spurious spur at bottom right, crest blob |
| Hunyuan3D 2.0 (shape) | orn-figure-hmdh-bust | 301.8 | 20.0 | 272,678 | none | 1.122 | -21.3 | **better** (better / better) | untextured grey, back of the mesh is a deep slab lump in oblique |
| Hunyuan3D 2.0 (shape) | orn-gabletop-stationsplein | 396.9 | 22.0 | 1,135,796 | none | 1.033 | 19.7 | **better** (better / better) | untextured grey, windows barely read, includes extra storey below |
| Hunyuan3D 2.0 (shape) | orn-relief-hoofdbureau | 489.2 | 23.0 | 80,730 | none | 0.033 | 11.6 | **better** (better / better) | untextured dark grey, flat cut-out with no wall, stray spike artifacts |

How to read the columns:

- **tris:** the triangle count of the GLB as exported.
- **texture:**
  - `vc`: vertex colours only;
  - `PBR n×`: a UV-mapped baseColor/MR/normal texture set;
  - `none`: shape only.
- **depth/w:** the model's depth divided by its width after placement. A real front is about 0.05–0.15.
- **w err:** the width at the game's height compared with the BAG wall length.

¹ TRELLIS.2 front-h-28 ran at the template default (shape upsample 1536, texture 4096) under load average around 250, which took 52 min. Every other TRELLIS.2 item ran at `--upsample=1024 --tex=2048`.

The Hunyuan3D peak footprint (18–23 GB) is the whole ComfyUI server with the TRELLIS.2 models still resident, so Hunyuan alone needs less.

### Failure modes seen

**Cut-out decides the result (TripoSR).**
- rembg/u2net kept only the cornice or a fragment on H54, K604 and H38. Every rembg front lost.
- The BiRefNet cut-out fixed those three. It failed instead on the white K632 front, where it cut the facade into window-shaped holes and floating pieces.
- None of the models can do better than its mask.

**Invented depth.**
- TripoSR makes every front a deep block: depth/width is 1.0–1.2 with BiRefNet, against about 0.1 for a real front. Its sides carry invented windows.
- From the 35° view this reads as a free-standing tower, not a terrace front.
- Hunyuan was flatter on some fronts (K632 0.10, H36 0.19) but deep on others (H28 0.87, H38 0.90).
- TRELLIS.2 was flattest when it worked (0.09–0.29) but has two failure states:
  - it returns the whole input as a flat slab (relief, gable top);
  - or it returns a black box (H38, depth/width 3.2).

**TRELLIS.2 slab/box collapse.**
- 4 of 10 TRELLIS.2 outputs are useless rectangles or boxes: H28, H38, the gable top, and the relief.
- On the cartouche it modelled the whole plaque, wall included (width error +284%). The judge still preferred it to today's slab.

**Colour.**
- All textured outputs come out darker and greyer than the photo.
  - TripoSR vertex colours are low-saturation. The relief comes out dark brown and the bust blue-tinted.
  - TRELLIS.2 base colour is desaturated: the H36 texture averages RGB 112/114/117 on a red-brick front.
- None of them matches the photo tone the house programme requires (kit fronts must match photo tone).

**Hunyuan3D has no texture here.**
- Hunyuan3D-Paint is not native in ComfyUI. Its renders are untextured grey, and the judge counted that against it on every front.
- Its geometry is the most faithful of the four: gable silhouettes, cornices, the stoop, and the bust in profile.

**Artefacts.**
- Hoist beams and spikes stick out of roofs (K604 in all three models).
- A spurious pole or slab appears beside H38 (TripoSR, Hunyuan).
- Debris clusters at the base of fronts.
- An ornament's back is a lump when seen from the side (the bust, in all models).

**Scale.**
- Width at the game's height is within ±15% for most fronts (TripoSR-BiRefNet, Hunyuan, TRELLIS.2 when it works).
- The outliers are the fragment and slab failures.

**Triangles and textures.**
- TRELLIS.2 always decimates to about 700k triangles and ships three 2048–4096² textures (21–62 MB GLB).
- Hunyuan gives 80k–1.1M triangles; TripoSR gives 40k–435k.
- All are 10–100× over a game ornament budget, so any install would need decimation (`gltf-transform simplify`) and a texture bake to the kit palette.

## Licences

| model | code / weights | licence | URL | can outputs ship to EU players? |
|---|---|---|---|---|
| TripoSR | VAST-AI-Research/TripoSR; weights stabilityai/TripoSR; encoder facebook/dino-vitb16; rembg u2net | MIT; MIT; Apache-2.0; Apache-2.0 | https://github.com/VAST-AI-Research/TripoSR/blob/main/LICENSE, https://huggingface.co/stabilityai/TripoSR | yes |
| TRELLIS.2 | microsoft/TRELLIS.2-4B; ComfyUI repackage Comfy-Org/TRELLIS.2; DINOv3 ViT-L image encoder; BiRefNet | MIT; MIT; Meta DINOv3 License (encoder file only); MIT | https://huggingface.co/microsoft/TRELLIS.2-4B, https://huggingface.co/Comfy-Org/TRELLIS.2, https://huggingface.co/Comfy-Org/BiRefNet | yes for the outputs; read the DINOv3 terms before redistributing the weights themselves |
| Pixal3D | TencentARC/Pixal3D; ComfyUI mirror Comfy-Org/Pixal3D | LICENSE text MIT ("Copyright (c) 2026 Tencent"), but the HF card sets `extra_gated_eu_disallowed: true`; the Comfy-Org mirror is MIT and ungated | https://huggingface.co/TencentARC/Pixal3D | unclear: the MIT text conflicts with an EU gate on the original repo. Ask before relying on it |
| Hunyuan3D 2.0 / 2.1 / 2mini | tencent/Hunyuan3D-2 (run here via the Comfy-Org/Hunyuan-3D-2.0 fp16 split file) | Tencent Hunyuan 3D 2.0 Community License | https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE ; 2.1: https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE | **no** (see below) |
| Hi3D | yanghb22-fdu/Hi3D-Official | MIT | https://github.com/yanghb22-fdu/Hi3D-Official | n/a (not run) |

The Comfy blog (https://blog.comfy.org/p/trellis2-and-pixal3d-are-now-native) says the native TRELLIS.2 and Pixal3D nodes need no custom nodes or CUDA extensions. It also says they drop nvdiffrast/nvdiffrec (NVIDIA non-commercial licence), so "everything is free to use, including commercially". The blog does not mention Mac, but both pipelines ran here on MPS.

### Hunyuan3D shipping flag (a decision for David later; it does not block the trial)

Running the trial in the US is within the licence. Shipping its **outputs** in the public game is not:

- The header says: "THIS LICENSE AGREEMENT DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA".
- §1(l) defines a Territory that excludes those regions.
- §5(c): "You must not use, reproduce, modify, distribute, or **display** the Tencent Hunyuan 3D 2.0 Works, **Output or results** … outside the Territory. Any such use outside the Territory is unlicensed and unauthorized".

The game is served to EU players, with the Amsterdam audience first. Any Hunyuan-made GLB would be displayed in the EU, which the licence does not allow.

Other clauses to note:

- §4: a separate licence is required above 1M MAU.
- §3(d)/(e): a Notice file and a disclosure are required.
- §5(b): outputs may not be used to improve other models.
- §5(a): an Acceptable Use Policy applies.

**Recommendation: do not ship Hunyuan outputs in the public game unless that position changes.**

## Skipped

**Pixal3D (disk).**

- It needs about 7.4 GB more weights: the Pixal3D DiT, NAF DINO and MoGe geometry.
- Downloads since the coordinator's disk instruction already total about 5.9 GB of the 10 GB cap: the TRELLIS.2 remainder plus 4.9 GB for Hunyuan.
- The ComfyUI template is ready (`comfy_run.py --model=pixal3d`); only the weights are missing.

**Hi3D (cannot run on the M4 Pro as released, and over budget).**

- The code hardcodes `.cuda().half()` and `torch.autocast('cuda')`.
- It pins xformers 0.0.22, triton 2.0.0 and the nvidia-cu11 wheels, and was tested only on an A100 with CUDA 11.8.
- It outputs only multi-view images. The paper's 3D Gaussian Splatting/mesh stage is not in the repo: none of its 175 files are reconstruction code.
- The weights total about 20 GB (first_stage.pt 7.83 GB, second_stage.pt 6.95 GB, ckpts.zip 4.98 GB).
- The last push was 2024-09-13.

**Hunyuan3D texture stage (Hunyuan3D-Paint).**

- It is not native in ComfyUI and needs custom CUDA rasteriser builds.
- The 2.0 trial is therefore shape only, and its renders are untextured grey.

## Recommendation per model

| model | fronts | ornaments | statues / figures | recommendation |
|---|---|---|---|---|
| **TripoSR + BiRefNet cut-out** | no | **yes, as a draft** | **yes, as a draft** | Use for ornament and figure drafts: 10–16 s each, MIT, open weights. Each output then needs decimation, flattening against the wall (the back lump must go), and a colour pass to stone/brick tone. Never use the shipped rembg cut-out. |
| **Hunyuan3D 2.0** (shape) | no | best geometry | best geometry | Technically the best shapes for ornaments, figures and gable silhouettes. **Cannot ship to EU players under its licence** (§5(c), see above). Only usable as a private reference for hand-modelling, if David accepts that. Otherwise nothing. |
| **TRELLIS.2** (ComfyUI native, int8 on MPS) | no | no | maybe | Nothing for now. Fronts and ornaments failed 4 of 10 times with a slab or box collapse; when it works (H36, H54, K604, the bust) it is the only one with a real texture set. It takes 5–50 min per input on this Mac. Revisit only for statues, and only if a run on an idle machine is cheap. |
| **Pixal3D** | — | — | — | Not run (disk cap). The template is wired; worth a single ornament test if about 7.4 GB frees up. Its EU gate needs a licence ruling first. |
| **Hi3D** | — | — | — | Nothing: CUDA-only, multi-view images only, about 20 GB of weights. |

**Canal fronts:** none of these should replace the kit. Even the wins are single-object towers with
invented depth, sides and colour, and they lose to the kit on ordinary narrow brick fronts. The useful
signal for the house programme is that the kit loses on wide stucco/stone double fronts (H54, K604) and
step gables (H38). Those are kit gaps to fill in the kit, not with generated meshes.

**Ornaments:** a next lane could take TripoSR+BiRefNet drafts for the inventory of signature ornaments
(gable tops, cartouches, busts, reliefs) through a fixed post-process: decimate to about 5–10k triangles,
cut at the wall plane, recolour to the measured stone tone, and attach to the landmark GLB. A blind
in-situ A/B against the current landmark should gate that work.

## Reproduce

**Install** (outside the repo, in `~/Code/image-to-3d-20261121/`):

- `ComfyUI` at a277b5bf (v0.46.0).
- `venv-comfy`: Python 3.12, torch 2.15.0, transformers 5.24.0, comfy-kitchen 0.2.41, comfy-aimdo 0.6.0, trimesh 5.2.1.
- `triposr-src` at 107cefdc. Its venv (Python 3.11, torch 2.5.1) was deleted after the runs for disk.

**Weights:** in `~/.cache/huggingface/manual/<repo>/…`, fetched by a sha256-checked parallel range downloader (`dl/pget.sh`) because hf_xet stalled.

**Scripts** (in `scripts/image-to-3d/`):

- `ornament-view.ts`: the pano pinhole crops.
- `birefnet_cutouts.py`.
- `run-triposr-batch.sh` with `ply_to_glb.py`.
- `comfy_ui_to_api.py`, `comfy_run.py` and `run-comfy-batch.sh`.
- `place-render.ts` with `place_all.py`.
- `collect.py`.
- `sheets.py`.
- `judge-brief.md`.

**Outputs:** in `artifacts/image-to-3d/` (gitignored): `runs/<model>/<input>/`, `blind/`, `overview-<model>.jpg`, `results.json` and `judge.json`.

## Disk

| item | size | status |
|---|---|---|
| `~/.cache/huggingface/manual/Comfy-Org/TRELLIS.2` | 7.9 GB | kept |
| `~/.cache/huggingface/manual/Comfy-Org/Hunyuan-3D-2.0` (fp16 DiT) | 4.6 GB | kept |
| `~/.cache/huggingface/manual/Comfy-Org/BiRefNet` | 0.4 GB | kept |
| `~/Code/image-to-3d-20261121/venv-comfy` + `ComfyUI` | 1.8 GB + 0.5 GB | kept |
| TripoSR weights + `venv-triposr` | about 2 GB | deleted after the runs (disk fell to 6.6 GB free mid-lane) |
| `artifacts/image-to-3d/` (gitignored; GLBs, renders, sheets) | see `du -sh` | not in git |

The total currently held is about 15 GB. Free it with
`rm -rf ~/.cache/huggingface/manual/Comfy-Org ~/Code/image-to-3d-20261121` once nobody needs a re-run.

Skipped for disk: the Pixal3D weights (about 7.4 GB) and the Hi3D weights (about 20 GB; also CUDA-only).
The ComfyUI server was stopped by PID after the runs.

## Sheets

- `artifacts/image-to-3d/bakeoff-key-sheet.jpg` is the labelled key sheet. Each input gets a row:
  photo | today | TripoSR-BiRefNet | TRELLIS.2 | Hunyuan3D, with the front view above the 35° oblique.
  - It is copied to `~/Code/map-recall2-screenshots/research/image-to-3d-bakeoff-20261121.jpg`.
  - That copy is not committed there.
- Also in `artifacts/image-to-3d/` (all gitignored):
  - `overview-<model>.jpg`, one per model;
  - `blind/*.jpg` (40 sheets, 6.4 MB) and `blind/key.json`;
  - `judge-raw.json`, the blind replies;
  - `judge.json`, the unblinded verdicts.
