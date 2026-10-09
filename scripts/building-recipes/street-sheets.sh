#!/bin/sh
# Bilderdijkstraat review sheets (crop | front | 3/4), four sheets of up to five houses.
#   sh scripts/building-recipes/street-sheets.sh <out-prefix>   e.g. artifacts/recipe-look/after
set -e
out=${1:-artifacts/recipe-look/sheet}
render() { node --import tsx scripts/building-recipes/render.ts --sheet="$1" --out="$2"; }
render bilder-079721,bilder-080336,bilder-081118,bilder-087959,bilder-090492 "$out-1.png"
render bilder-092394,bilder-092395,bilder-152363,bilder-152669,bilder-153622 "$out-2.png"
render bilder-153782,bilder-154127,bilder-155417,bilder-155418,bilder-156286 "$out-3.png"
render bilder-156287,bilder-156732,bilder-157154,bilder-157650 "$out-4.png"
