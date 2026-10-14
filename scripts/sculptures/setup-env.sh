#!/bin/sh
# Recreates the route B tool environment OUTSIDE the repo (default ~/Code/map-recall2-sculpt, override with SCULPTURE_TOOLS):
#   venv-triposr  torch 2.5.1 + TripoSR deps + rembg (run_triposr.py)
#   venv-o3d      open3d 0.18 + trimesh + Pillow (decimate_scale_glb.py, compare_sheet.py); a separate process because torch and open3d segfault together
#   triposr-src   VAST-AI-Research/TripoSR (MIT); weights stabilityai/TripoSR download into the Hugging Face cache on first run
set -e
T="${SCULPTURE_TOOLS:-$HOME/Code/map-recall2-sculpt}"
mkdir -p "$T"; cd "$T"
[ -d triposr-src ] || git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR.git triposr-src
[ -d venv-triposr ] || uv venv --python 3.11 venv-triposr
[ -d venv-o3d ] || uv venv --python 3.11 venv-o3d
uv pip install --python venv-triposr/bin/python torch==2.5.1 transformers==4.35.0 huggingface-hub==0.17.3 omegaconf==2.3.0 einops==0.7.0 \
  Pillow==10.1.0 numpy==1.26.4 trimesh==4.0.5 scikit-image==0.24.0 rembg==2.0.59 onnxruntime==1.19.2 imageio==2.34.0
uv pip install --python venv-o3d/bin/python open3d==0.18.0 numpy==1.26.4 trimesh==4.0.5 Pillow==10.1.0
