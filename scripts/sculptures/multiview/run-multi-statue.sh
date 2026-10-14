#!/bin/zsh
# TRELLIS.2 multidiffusion (trellis2-apple, MLX) on prepared RGBA cut-outs of one statue, run from the worktree root.
#   scripts/sculptures/multiview/run-multi-statue.sh <statue id> <rgba.png> [<rgba.png> ...]
# Cut-outs come from prep_inputs.py (artifacts/sculpture-reconstruction/<id>/mv-inputs). Writes
# artifacts/sculpture-reconstruction/<id>/trellis2-apple-multi/{raw.ply,timing.json}. One run at a time (about 27 GB).
ID=$1; shift
ROOT=$PWD
OUT=$ROOT/artifacts/sculpture-reconstruction/$ID/trellis2-apple-multi
TOOLS=${SCULPTURE_TOOLS:-$HOME/Code/map-recall2-sculpt}
IMGS=()
for f in "$@"; do IMGS+=("$ROOT/$f"); done
cd $TOOLS/mv/trellis2-apple/src
export HF_HOME=$TOOLS/mv/weights/hf HF_HUB_OFFLINE=1
../venv/bin/python -I $ROOT/scripts/sculptures/multiview/run_trellis2.py $OUT $IMGS \
  --dino=$TOOLS/mv/weights/dinov3-vitl16-hf --mode=multidiffusion --backend=mlx
