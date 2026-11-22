#!/bin/bash
# TripoSR over every input: one process per image under /usr/bin/time -l (peak RSS), run from the TripoSR checkout.
#   bash scripts/image-to-3d/run-triposr-batch.sh <inputs dir> <out dir> [<cut-out dir: RGBA png per input, replaces rembg>]
set -u
B=${IMAGE_TO_3D_TOOLS:-$HOME/Code/image-to-3d-20261121}
IN=$(cd "$1" && pwd); CUT=${3:+$(cd "$3" && pwd)}; OUT=$(mkdir -p "$2" && cd "$2" && pwd); HERE=$(cd "$(dirname "$0")/.." && pwd)
cd "$B/triposr-src"
for f in "$IN"/*.png; do
  id=$(basename "$f" .png); o="$OUT/$id"; mkdir -p "$o"
  [ -f "$o/raw.ply" ] && continue; rm -f "$o"/*
  /usr/bin/time -l "$B/venv-triposr/bin/python" -I "$HERE/sculptures/run_triposr.py" --src="$B/triposr-src" --image="$f" --out="$o" --mc=256 --weights="$HOME/.cache/huggingface/manual/stabilityai/TripoSR" ${CUT:+--cutout="$CUT/$id.png"} > "$o/log.txt" 2> "$o/time.txt"
  echo "$id $(grep -E 'maximum resident' "$o/time.txt" | awk '{print $1}') $(tail -1 "$o/log.txt" | head -c 200)"
done
