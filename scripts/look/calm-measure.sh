#!/bin/bash
# Calm-frame measurement chain (#161, 2026-11-09). Run from the repo root after building this checkout's bundles into
# artifacts/calm/bundles:  node scripts/build-canal-engine.mjs --outdir=artifacts/calm/bundles
#   node scripts/build-3d-bundles.mjs --outdir=artifacts/calm/bundles   (+ the three build:canal-* palette bundles)
# Usage: scripts/look/calm-measure.sh <outdir> '<B-side query>'   (A side is the default look; B side is the query)
# Then:  python3 scripts/look/calm-table.py <outdir> default world   (busyness far/near + on-screen label counts)
EVAL='({n:vm._labels.placed.length,kinds:vm._labels.placed.reduce((a,l)=>{a[l.kind]=(a[l.kind]||0)+1;return a},{}),poiTop:vm._labels.placed.filter(l=>l.kind==="poi"&&l.y<vm.host.viewport().height/3).length,pois:vm._labels.placed.filter(l=>l.kind==="poi").map(l=>[l.text,Math.round(l.x),Math.round(l.y)])})'
ENGINE=own WORLD_AB=1 WORLD_AB_STALE=1 AB_CAMERA=fixed AB_DPR=1 AB_TREES3D=1 BUNDLES_DIR=$PWD/artifacts/calm/bundles AB_EVAL="$EVAL" AB_DIR="$1" AB_B_QUERY="$2" PW_PORT=${PW_PORT:-4744} \
  bash /tmp/canal-pw.sh npx playwright test world-v1-ab --project=desktop --workers=1 --reporter=line > "$1.log" 2>&1
echo done >> "$1.log"
