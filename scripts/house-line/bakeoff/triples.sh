#!/bin/zsh
# Lane BK: per-pand bake-off sheets. Panels: photo (pano cut at the pose) | today | A (staged spec) / A+fit (WG storey
# fit) | B (F1 record, ?shaderFacades=1) | C (recipe GLB, Node 3/4 render: no ?world=live frame without an install).
# All browser panels are house:frames halves at the same pose (same panorama). JPEG q82, 1560 px wide.
#   scripts/house-line/bakeoff/triples.sh <frames dir> <preview dir> <out dir> <pand key ...>
set -eu
FR=$1 PV=$2 OUT=$3; shift 3
FONT=/System/Library/Fonts/Supplemental/Arial.ttf
TMP=$(mktemp -d)
mkdir -p $OUT
for k in "$@"; do
  half() { magick $FR/$1/$k/pair.jpg -crop 723x700+0+20 +repage $TMP/$2.png; }
  game() { magick $FR/$1/$k/pair.jpg -crop 723x700+723+20 +repage $TMP/$2.png; }
  half today photo; game today today; game a-staged a; game a-fit afit
  if [ -f $FR/b/$k/pair.jpg ]; then game b b; else magick -size 723x700 xc:'#888' $TMP/b.png; fi
  magick $PV/c/$k/threeq.png -resize 723x700 -background '#c8c8c8' -gravity center -extent 723x700 $TMP/c.png
  montage -font $FONT -pointsize 22 \
    -label "photo $k" $TMP/photo.png -label 'today (?world=live)' $TMP/today.png -label 'A: staged spec' $TMP/a.png \
    -label 'A+fit: WG storey fit' $TMP/afit.png -label 'B: F1 record ?shaderFacades=1' $TMP/b.png -label 'C: recipe GLB (Node 3/4)' $TMP/c.png \
    -tile 3x2 -geometry 520x504+4+4 -background '#222' -fill white $TMP/sheet.png
  magick $TMP/sheet.png -resize '1600x1600>' -quality 82 $OUT/$k-triple.jpg
  echo $OUT/$k-triple.jpg
done
rm -rf $TMP
