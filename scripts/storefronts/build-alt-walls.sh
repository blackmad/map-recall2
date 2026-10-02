#!/bin/sh
# For businesses whose --near wall showed no shopfront: crop every other exposed wall of their
# building, so the right face (onto a square, round a corner) can be picked by eye.
#   sh scripts/storefronts/build-alt-walls.sh slugs.txt tmp/storefronts/candidates.tsv tmp/storefronts/refs tmp/storefronts/refs-alt
slugs=$1; list=$2; refs=$3; out=$4; mkdir -p "$out"
while read -r slug; do
  pand=$(grep "^$slug	" "$list" | cut -f6)
  chosen=$(grep -o "chosen wall [0-9]*" "$refs/$slug.log" 2>/dev/null | grep -o "[0-9]*$")
  for w in $(grep -o "wall [0-9]*: [0-9.]* m" "$refs/$slug.log" 2>/dev/null | awk '$3 + 0 >= 3 {print $2}' | tr -d ':'); do
    [ "$w" = "$chosen" ] && continue
    [ -f "$out/$slug-w$w.json" ] || [ -f "$out/$slug-w$w.fail" ] || echo "$slug $pand $w"
  done
done < "$slugs" | xargs -P 6 -L 1 sh -c 'NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt timeout 300 npx tsx scripts/pano-facades/build-pano-facade.ts --name=$0-w$2 --ids=$1 --wall=$2 --top=7 --ppm=40 --max-panos=1 --min-standoff=2 --max-dist=40 --max-obl=60 --out='"$out"' > '"$out"'/$0-w$2.log 2>&1 || touch '"$out"'/$0-w$2.fail'
echo "alt walls: $(ls "$out"/*.json 2>/dev/null | wc -l) built, $(ls "$out"/*.fail 2>/dev/null | wc -l) failed"
