#!/bin/zsh
# Lane WC (#384): per-pand row sheets, photo | today | D1 off | (a) floor | (b) gain | (c) norm | (c)+(a) normfloor, each panel
# the game half of a house:frames pair at the same pose (the photo from the first dir). (a) is floor2/normfloor2: the staging
# floor AND the decoration floor lowered (the staging floor alone changes no pixel: SPEC_WALL_LIFT.minL floors it again).
#   sheets.sh <frames root> <prefix (row|bv2|fin)> <out dir> <key ...>
#   CONDS="sx-off:D1 staged off,sx-finish2:finish" overrides the panels after photo | today (dir suffix:label).
set -eu
FR=$1 P=$2 OUT=$3; shift 3
FONT=/System/Library/Fonts/Supplemental/Arial.ttf
CONDS=${CONDS:-"sx-off:D1 staged off,sx-floor2:(a) floor,sx-gain:(b) gain,sx-norm:(c) norm,sx-normfloor2:(c)+(a) normfloor"}
TODAY=${TODAY:-today}
TMP=$(mktemp -d); mkdir -p $OUT
cut() { local w=$(magick identify -format %w $1); magick $1 -crop $((w/2))x$((w*700/1446))+$2+$((w*20/1446)) +repage $3; }
lab() { python3 -c "import json;p=json.load(open('$FR/$P-$1/$k/pose.json'));l=p['lab']['$2'];print(f\"L {l['L']:.2f} C {l['C']:.3f} {l['hex']}\")" 2>/dev/null || echo '-'; }
for k in "$@"; do
  w=$(magick identify -format %w $FR/$P-$TODAY/$k/pair.jpg)
  cut $FR/$P-$TODAY/$k/pair.jpg 0 $TMP/photo.png; cut $FR/$P-$TODAY/$k/pair.jpg $((w/2)) $TMP/today.png
  args=(-label "photo $k  $(lab $TODAY photo)" $TMP/photo.png -label "today  $(lab $TODAY game)" $TMP/today.png)
  n=2
  for spec in ${(s:,:)CONDS}; do
    c=${spec%%:*} l=${spec#*:}
    cut $FR/$P-$c/$k/pair.jpg $((w/2)) $TMP/$c.png
    args+=(-label "$l  $(lab $c game)" $TMP/$c.png); n=$((n+1))
  done
  montage -font $FONT -pointsize 18 "${args[@]}" -tile ${n}x1 -geometry 400x388+3+3 -background '#222' -fill white \
    -title "own engine, compiled world-v1 (today: published cells; options: published + world:compile --changed per flag)" $OUT/$k.png
  magick $OUT/$k.png -quality 82 $OUT/$k.jpg && rm $OUT/$k.png
  echo $OUT/$k.jpg
done
rm -rf $TMP
