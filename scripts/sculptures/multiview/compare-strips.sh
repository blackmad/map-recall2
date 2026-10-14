#!/bin/zsh
# Gallery-size four-side strips of every tool's De Dokwerker mesh, stacked into compare-tools.png and a
# <300 KB JPEG for the docs. Run from the worktree root after the trial (docs/multiview-reconstruction-survey-20261014.md).
set -e
D=artifacts/sculpture-reconstruction/de-dokwerker
strip() { # glb outdir title
  [ -f "$1" ] || { echo "skip $1"; return 0; }
  node --import tsx scripts/landmarks/landmark-strip.ts --id=x --glb="$1" --out="$2" --title="$3" | tail -1
  ROWS+=("$2/strip-four-sides.png")
}
ROWS=()
strip public/canal-drive/models/de-dokwerker.glb $D/strip-kit "Kit model (in the game today)"
strip $D/routeB-triposr.glb $D/strip-triposr "TripoSR, 1 Commons photo (a007), ~20 s"
strip $D/trellis-mac-single.glb $D/strip-trellis-mac-single "TRELLIS.2 via trellis-mac (MPS), 1 photo, 2.7 min (+2.5 min load); figure on a box plinth"
strip $D/trellis2-apple-single.glb $D/strip-trellis2-apple-single "TRELLIS.2 via trellis2-apple (MLX), 1 photo; figure on a box plinth"
strip $D/trellis-mac-multi.glb $D/strip-trellis-mac-multi "TRELLIS.2 via trellis-mac, 4 Commons photos (0/90/180/-90 deg), multidiffusion, 9.5 min; box plinth"
strip $D/trellis2-apple-multi.glb $D/strip-trellis2-apple-multi "TRELLIS.2 via trellis2-apple (MLX), 4 Commons photos, multidiffusion; box plinth"
strip $D/vggt-mixed10.glb $D/strip-vggt "VGGT-1B, 6 panoramas + 4 Commons photos, put in metres by the panorama poses, 38 s (CPU)"
strip $D/mapanything-panos6.glb $D/strip-mapanything "MapAnything (Apache weights), 6 panoramas, metres by panorama poses, 21 s"
/Users/blackmad/Code/map-recall2-sculpt/venv-o3d/bin/python -I scripts/sculptures/stack_strips.py $D/compare-tools.png $ROWS
mkdir -p docs/images/sculptures
magick $D/compare-tools.png -resize 1600x -strip -quality 72 docs/images/sculptures/de-dokwerker-tools.jpg
ls -la $D/compare-tools.png docs/images/sculptures/de-dokwerker-tools.jpg
