#!/bin/bash
# Every input through one ComfyUI model, sequentially; stops if free disk drops under MIN_FREE_GB (default 5).
#   bash scripts/image-to-3d/run-comfy-batch.sh <model> <out dir> [extra comfy_run.py flags...]
set -u
M=$1; OUT=$2; shift 2
B=${IMAGE_TO_3D_TOOLS:-$HOME/Code/image-to-3d-20261121}
HERE=$(cd "$(dirname "$0")" && pwd); A=$(cd "$HERE/../../artifacts/image-to-3d" && pwd)
for f in "$A"/inputs/*.png; do
  id=$(basename "$f" .png)
  [ -f "$OUT/$id/run.json" ] && continue
  free=$(df -g ~ | tail -1 | awk '{print $4}')
  [ "$free" -lt "${MIN_FREE_GB:-5}" ] && { echo "STOP: ${free} GB free"; exit 1; }
  "$B/venv-comfy/bin/python" -I "$HERE/comfy_run.py" --server=127.0.0.1:8834 --comfy="$B/ComfyUI" --model="$M" \
    --api="$A/comfy/trellis-pixal-api.json" --image="$f" --out="$OUT/$id" "$@" | cut -c1-300
done
