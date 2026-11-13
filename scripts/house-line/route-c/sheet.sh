#!/bin/zsh
# Lane C-completer: one sheet per pand, photo | today | A+fit | C, and a row contact sheet.
#   scripts/house-line/route-c/sheet.sh frames <frames dir> <C preview dir> <out dir> <key ...>
#       photo, today and A+fit are house:frames halves at one pose (the bake-off's frames/{today,a-fit}/<key>/pair.jpg)
#   scripts/house-line/route-c/sheet.sh node <photo dir> <A preview dir> <C preview dir> <out dir> <pandId:key ...>
#       a row with no frames run (the integration gate): photo = the D1 describe cut, today / A+fit = house:preview Node
#       fronts (generic route, published and staged specs), C = house:preview --recipe 3/4 view
set -eu
FONT=/System/Library/Fonts/Supplemental/Arial.ttf
TMP=$(mktemp -d)
MODE=$1; shift
panel() { magick "$1" -resize 520x504 -background '#c8c8c8' -gravity center -extent 520x504 "$2"; }
if [ $MODE = frames ]; then
  FR=$1 C=$2 OUT=$3; shift 3
  mkdir -p $OUT
  for k in "$@"; do
    magick $FR/today/$k/pair.jpg -crop 723x700+0+20 +repage $TMP/p.png; panel $TMP/p.png $TMP/photo.png
    magick $FR/today/$k/pair.jpg -crop 723x700+723+20 +repage $TMP/t.png; panel $TMP/t.png $TMP/today.png
    magick $FR/a-fit/$k/pair.jpg -crop 723x700+723+20 +repage $TMP/a.png; panel $TMP/a.png $TMP/afit.png
    panel $C/$k/threeq.png $TMP/c.png
    montage -font $FONT -pointsize 22 -label "photo $k" $TMP/photo.png -label 'today (?world=live)' $TMP/today.png \
      -label 'A+fit (WG storey fit)' $TMP/afit.png -label 'C: completed recipe (Node 3/4)' $TMP/c.png \
      -tile 4x1 -geometry 520x504+4+4 -background '#222' -fill white $TMP/s.png
    magick $TMP/s.png -quality 82 $OUT/$k-c.jpg; echo $OUT/$k-c.jpg
  done
else
  PH=$1 A=$2 C=$3 OUT=$4; shift 4
  mkdir -p $OUT
  for pk in "$@"; do
    p=${pk%%:*} k=${pk##*:}
    panel $PH/$p.jpg $TMP/photo.png
    panel $A/today/$k/front.png $TMP/today.png
    panel $A/a-staged/$k/front.png $TMP/afit.png
    panel $C/$k/threeq.png $TMP/c.png
    montage -font $FONT -pointsize 22 -label "photo $k (D1 cut)" $TMP/photo.png -label 'today (Node front)' $TMP/today.png \
      -label 'A: staged spec (Node front)' $TMP/afit.png -label 'C: completed recipe (Node 3/4)' $TMP/c.png \
      -tile 4x1 -geometry 520x504+4+4 -background '#222' -fill white $TMP/s.png
    magick $TMP/s.png -quality 82 $OUT/$k-c.jpg; echo $OUT/$k-c.jpg
  done
fi
rm -rf $TMP
