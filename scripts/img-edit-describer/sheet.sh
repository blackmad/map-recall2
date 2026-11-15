#!/bin/zsh
# One review sheet per front: occluded crop | edited (photo) | edited (elevation) | leaf-off / truth, labelled.
#   scripts/img-edit-describer/sheet.sh <out.jpg> <title> <label=path> [<label=path> ...]
# Missing panels draw as grey "none". Heights are matched to 640 px.
set -eu
OUT=$1; TITLE=$2; shift 2
FONT=/System/Library/Fonts/Helvetica.ttc
TMP=$(mktemp -d)
i=0
for pair in "$@"; do
  label=${pair%%=*}; file=${pair#*=}
  if [ -f "$file" ]; then
    magick "$file" -resize x640 -background white -gravity north -font $FONT -pointsize 22 -splice 0x34 -annotate +0+4 "$label" "$TMP/$i.png"
  else
    magick -size 360x640 xc:'#bbb' -font $FONT -pointsize 22 -gravity center -annotate +0+0 "none" -background white -gravity north -splice 0x34 -annotate +0+4 "$label" "$TMP/$i.png"
  fi
  i=$((i+1))
done
magick $TMP/*.png -bordercolor white -border 6 +append -background white -font $FONT -pointsize 24 -gravity north -splice 0x40 -annotate +0+8 "$TITLE" -quality 85 "$OUT"
rm -rf "$TMP"
