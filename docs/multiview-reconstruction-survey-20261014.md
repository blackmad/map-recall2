# Multi-view reconstruction tools: survey and trial (2026-10-14)

Question from the user: are there multi-photo reconstruction tools beyond the
single-photo TripoSR prototype (`docs/sculpture-reconstruction-20261014.md`),
for example Microsoft TRELLIS.2, and do they now run locally on this Mac
(M4 Pro, 48 GB unified memory, macOS 26, no NVIDIA GPU)?

State checked on 2026-10-14 from the project pages and model cards listed
under each row. "EU" means use in the Netherlands is within the licence;
"hobby" means a non-commercial, open-data project that publishes its output.

## Survey

Two families matter here, and they answer different questions:

- **Generative image-to-3D** (TRELLIS, TRELLIS.2, Hunyuan3D, SAM 3D, SF3D,
  SPAR3D, InstantMesh, Wonder3D/Era3D, TripoSR). They produce a complete,
  watertight object from one or a few images. The hidden sides are invented
  by a learned prior.
- **Feed-forward multi-view geometry** (DUSt3R/MASt3R, VGGT, MapAnything, π³,
  Depth Anything 3) and **classic photogrammetry** (COLMAP + OpenMVS, Apple
  Object Capture, Gaussian splatting). They measure only what the photos see.
  They need several views with overlap and give points, depth or splats, which
  still have to be meshed.

| Tool | Multi-image input | Licence (EU / hobby) | Apple Silicon | Memory | Output | Runtime per object |
| --- | --- | --- | --- | --- | --- | --- |
| **TRELLIS** (Microsoft, v1, Dec 2024) | Yes, experimental: `run_multi_image`, unposed, any count, tuning-free (alternates or averages the image conditions per step) | MIT code and weights (diffoctreerast, FlexiCubes own licences); EU yes, hobby yes | No official port; CUDA (spconv, flash-attn, nvdiffrast) | 16 GB VRAM | Gaussians, radiance field, mesh, GLB | ~10–20 s on A100 |
| **TRELLIS.2-4B** (Microsoft, Dec 2025) | **No**: `run(image)` takes one image; no multi-image path in the pipeline | MIT code and weights; **conditioner DINOv3 is gated** (DINOv3 License: worldwide, redistribution allowed, AUP, trade controls); rembg **RMBG-2.0 is CC BY-NC 4.0** (bypassable with your own cut-out) | Upstream CUDA only (Linux, 24 GB) | 24 GB VRAM | PBR-textured GLB (O-Voxel) | 3 s (512³) to 60 s (1536³) on H100 |
| **trellis-mac** (shivampkumar) | No (single image; batching only reuses the loaded pipeline) | MIT port; same weight gates as TRELLIS.2 | **Yes, PyTorch MPS**: flash-attn → SDPA (padded), flex_gemm → `mtlgemm` Metal or `conv_none` gather-scatter, o_voxel hashmap → pure-Python mesh extract, nvdiffrast → `mtldiffrast` Metal or Python, cumesh skipped (no hole fill) | 24 GB+ recommended, ~18 GB peak | Vertex-colour OBJ + PBR GLB | ~3.5–5 min on M4 Pro (512 pipeline); author reports 36 min when thermally throttled |
| **trellis2-apple** (pedronaugusto) | No (fork of TRELLIS.2 `run(image)`; adds a texturing pipeline) | MIT; same weight gates | **Yes, MLX** backend plus Metal postprocessing (`mtldiffrast`, `mtlbvh`, `mtlmesh` as cumesh, `mtlgemm` as flex_gemm); needs torch ≥ 2.11 | not stated (M3 Max verified) | PBR GLB, alpha modes | not stated |
| **Hunyuan3D 2.0/2.1, 2mv** (Tencent) | 2mv: yes, posed front/left/back/right | Tencent Hunyuan Community Licence: **excludes the EU, UK and South Korea**. No 2026 change found. **Not usable here** | CUDA | 6–24 GB | Mesh + texture | ~30 s on GPU |
| **Hunyuan3D 3.0/3.1** | Yes, up to 4 (3.0) / 8 (3.1) views | Hosted API only; no open weights found | n/a | n/a | Mesh | n/a |
| **SAM 3D Objects** (Meta, Nov 2025) | No: one image plus a mask per object | SAM Licence: worldwide incl. EU, royalty-free, AUP and trade controls; weights gated on HF | **No**: Linux, NVIDIA ≥ 32 GB VRAM | 32 GB VRAM | Gaussian splat (+ mesh), with pose/layout | not stated |
| **SF3D / SPAR3D** (Stability) | No: one image (SPAR3D accepts an edited point cloud) | Stability AI Community Licence: free under USD 1 M revenue, EU yes | SPAR3D: **MPS experimental** (macOS ≥ 15.2, fallback on), CPU slow | 6–10.5 GB | Textured GLB | ~1 s GPU |
| **InstantMesh** (Tencent ARC) | No: one image → Zero123++ six views → LRM | Apache 2.0 | CUDA ≥ 12.1 | ~16 GB | Mesh | ~10 s GPU |
| **Wonder3D / Era3D** | No: one image → multi-view diffusion | Wonder3D AGPL-3.0 (unverified for Era3D) | CUDA | 16+ GB | Mesh via NeuS/instant-nsr | 2–3 min GPU |
| **TripoSR** (prototype) | No | MIT | Yes, MPS (with stubbed marching cubes) | ~6 GB | Mesh | ~20 s here |
| **DUSt3R / MASt3R** (Naver) | Yes, unposed; pairs plus global alignment (MASt3R-SfM for many) | **CC BY-NC-SA 4.0** code and weights, plus training-data licences (MapFree "very restrictive"); hobby/non-commercial only | Pure PyTorch; CUDA default, CPU/MPS possible | ~8–16 GB for tens of images | Point maps, matches, cameras | seconds per pair; minutes for 30 views |
| **VGGT** (Meta, CVPR 2025) | Yes, unposed, 1 to hundreds of views | Code: commercial use allowed (no military). Weights: `VGGT-1B` **CC BY-NC 4.0** (ungated); `VGGT-1B-Commercial` gated form | Pure PyTorch; CUDA in examples, CPU fallback; MPS untested upstream | ~1.2 B params, ~5 GB fp32 | Cameras, depth + confidence, point maps, tracks; COLMAP export for gsplat | < 1 s for tens of frames on H100 |
| **MapAnything** (Meta, Sep 2025, 3DV 2026) | Yes, unposed; optional intrinsics, poses, depth; metric scale | Code Apache 2.0; weights **`map-anything-apache` Apache 2.0** (EU yes, commercial yes) or `map-anything` CC BY-NC | Pure PyTorch; CUDA or CPU in examples; MPS untested upstream | memory-efficient mode, up to 2000 views on 140 GB | Metric world points, depth, rays, cameras, confidence; COLMAP/GLB export | seconds |
| **π³ / Pi3X** | Yes, unposed, permutation-equivariant (no reference view) | Code BSD; **weights CC BY-NC 4.0** | Pure PyTorch | similar to VGGT | Points, cameras | seconds |
| **Depth Anything 3** (ByteDance, Nov 2025) | Yes, any number of views, with or without poses | Code Apache; **DA3-BASE/SMALL/METRIC/MONO Apache 2.0, GIANT and LARGE CC BY-NC** per the README (HF tags `DA3-LARGE-1.1` as Apache; conflict) | Pure PyTorch + xformers on CUDA; MPS not mentioned | DA3-Streaming < 12 GB | Depth, rays, cameras, 3D Gaussians, GLB/PLY | seconds |
| **COLMAP 4 + OpenMVS** | Yes, unposed, needs overlap and texture | COLMAP BSD; OpenMVS AGPL-3.0 (fine for a tool run) | **Yes, CPU** (Homebrew `colmap` installed here) | RAM only | Sparse + dense points, mesh | minutes |
| **Apple Object Capture** (RealityKit `PhotogrammetrySession`) | Yes, unposed, ~20–200 photos with overlap | Apple SDK, free on macOS; output is yours | **Yes, native** (needs a GPU with ray tracing, i.e. Apple Silicon) | RAM only | USDZ/OBJ textured mesh | minutes |
| **Gaussian splatting on Mac**: Brush (Apache 2.0, wgpu/Metal), OpenSplat (AGPL, MPS), msplat (Metal), gsplat-mps fork (AGPL); nerfstudio/gsplat upstream are CUDA | Needs posed images (COLMAP) | as listed | Brush/OpenSplat yes | RAM only | Splat PLY | ~10 min per scene |

## Sources

- TRELLIS.2: https://github.com/microsoft/TRELLIS.2 ; pipeline config https://huggingface.co/microsoft/TRELLIS.2-4B/blob/main/pipeline.json (conditioner `facebook/dinov3-vitl16-pretrain-lvd1689m`, rembg `briaai/RMBG-2.0`)
- TRELLIS (v1, multi-image): https://github.com/microsoft/TRELLIS
- trellis-mac: https://github.com/shivampkumar/trellis-mac ; HN thread https://hn.svelte.dev/item/47828896 ; hands-on https://lilting.ch/en/articles/trellis2-m1-max-hands-on
- trellis2-apple: https://github.com/pedronaugusto/trellis2-apple (and `requirements_macos.txt` there)
- MLX re-port weights (gated DINOv3 inside): https://huggingface.co/xocialize/trellis2-mlx
- DINOv3 License and ungated timm redistribution: https://huggingface.co/timm/vit_large_patch16_dinov3_qkvb.lvd1689m
- Hunyuan3D licence: https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE ; 3.x hosted multi-view: https://www.scenario.com/models/hunyuan-3d-31-pro-multiview
- SAM 3D Objects: https://github.com/facebookresearch/sam-3d-objects (LICENSE, doc/setup.md)
- SPAR3D: https://github.com/Stability-AI/stable-point-aware-3d
- InstantMesh: https://huggingface.co/TencentARC/InstantMesh ; Wonder3D: https://github.com/xxlong0/Wonder3D
- VGGT: https://github.com/facebookresearch/vggt ; MapAnything: https://github.com/facebookresearch/map-anything
- MASt3R: https://github.com/naver/mast3r ; π³: https://github.com/yyfz/Pi3 ; Depth Anything 3: https://github.com/ByteDance-Seed/Depth-Anything-3
- Brush: https://github.com/ArthurBrussee/brush ; gsplat on Mac: https://github.com/iffyloop/gsplat-mps , https://radiancefields.com/opensplat-3dgs-now-on-mac
- Apple Object Capture: https://developer.apple.com/documentation/realitykit/photogrammetrysession
- Model gating checked with `https://huggingface.co/api/models/<repo>` on 2026-10-14.
