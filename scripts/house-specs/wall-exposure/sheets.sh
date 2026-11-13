#!/bin/zsh
# Lane WC (#384): per-pand row sheets, photo | today | off | (a) floor | (b) gain | (c) norm | (c)+(a) normfloor, each panel
# the game half of a house:frames pair at the same pose (the photo from the first dir). Then one sheet per row of pands.
#   sheets.sh <frames root> <prefix (row|bv2)> <out dir> <key ...>
set -eu
FR=$1 P=$2 OUT=$3; shift 3
FONT=/System/Library/Fonts/Supplemental/Arial.ttf
TMP=$(mktemp -d); mkdir -p $OUT
for k in "$@"; do
  magick $FR/$P-today/$k/pair.jpg -crop 723x700+0+20 +repage $TMP/photo.png
  for c in today sx-off sx-floor sx-gain sx-norm sx-normfloor; do magick $FR/$P-$c/$k/pair.jpg -crop 723x700+723+20 +repage $TMP/$c.png; done
  lab() { python3 -c "import json,sys;p=json.load(open('$FR/$P-$1/$k/pose.json'));l=p['lab']['$2'];print(f\"L {l['L']:.2f} C {l['C']:.3f} {l['hex']}\")"; }
  montage -font $FONT -pointsize 20 \
    -label "photo $k  $(lab today photo)" $TMP/photo.png -label "today  $(lab today game)" $TMP/today.png \
    -label "D1 staged, off  $(lab sx-off game)" $TMP/sx-off.png -label "(a) floor  $(lab sx-floor game)" $TMP/sx-floor.png \
    -label "(b) gain  $(lab sx-gain game)" $TMP/sx-gain.png -label "(c) norm  $(lab sx-norm game)" $TMP/sx-norm.png \
    -label "(c)+(a) normfloor  $(lab sx-normfloor game)" $TMP/sx-normfloor.png \
    -tile 7x1 -geometry 400x388+3+3 -background '#222' -fill white $OUT/$k.png
  magick $OUT/$k.png -quality 82 $OUT/$k.jpg && rm $OUT/$k.png
  echo $OUT/$k.jpg
done
rm -rf $TMP
