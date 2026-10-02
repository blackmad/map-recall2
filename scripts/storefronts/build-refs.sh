#!/bin/sh
# Ground-floor panorama crops for storefront candidates, 6 at a time; skips ones already built.
#   sh scripts/storefronts/build-refs.sh tmp/storefronts/candidates.tsv tmp/storefronts/refs
list=$1; out=$2; mkdir -p "$out"
cut -f1,4,5,6 "$list" | while IFS="$(printf '\t')" read -r slug lng lat pand; do
  [ -f "$out/$slug.json" ] || [ -f "$out/$slug.fail" ] || echo "$slug $lng $lat $pand"
done | xargs -P 6 -L 1 sh -c 'NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt timeout 300 npx tsx scripts/pano-facades/build-pano-facade.ts --name=$0 --ids=$3 --near=$1,$2 --top=7 --ppm=40 --max-panos=1 --min-standoff=2 --max-dist=40 --max-obl=60 --out='"$out"' > '"$out"'/$0.log 2>&1 || touch '"$out"'/$0.fail'
echo "refs: $(ls "$out"/*.json 2>/dev/null | wc -l) built, $(ls "$out"/*.fail 2>/dev/null | wc -l) failed"
