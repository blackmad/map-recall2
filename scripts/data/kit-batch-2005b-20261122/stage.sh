#!/bin/bash
# Stage large recipes for in-game frames without touching the committed catalogue (lane kit-batch-2005b-20261122).
#   bash scripts/data/kit-batch-2005b-20261122/stage.sh <id> '<allow-inferred>'   (repeat per house; entries accumulate)
# Writes artifacts/kit-batch-2005b/staged/{ordinary-buildings-data/catalogue.json,models/ordinary-buildings/*.glb}; frame
# with STAGED_CANAL_DIR=artifacts/kit-batch-2005b/staged (tests/e2e/helpers.ts).
set -euo pipefail
id=$1; allow=${2:-}
ST=artifacts/kit-batch-2005b/staged
mkdir -p $ST/ordinary-buildings-data $ST/models/ordinary-buildings
[ -f $ST/ordinary-buildings-data/catalogue.json ] || cp public/canal-drive/ordinary-buildings-data/catalogue.json $ST/ordinary-buildings-data/catalogue.json
node --import tsx scripts/building-recipes/install-large.ts --house=$id ${allow:+"--allow-inferred=$allow"}
cp artifacts/building-recipes/$id/model.glb $ST/models/ordinary-buildings/recipe-large-$id.glb
node -e "
const fs=require('fs');const f='$ST/ordinary-buildings-data/catalogue.json';const c=JSON.parse(fs.readFileSync(f,'utf8'));
const e=JSON.parse(fs.readFileSync('artifacts/building-recipes/$id/catalogue-entry.json','utf8'));
const i=c.models.findIndex(m=>m.id===e.id);if(i>=0)c.models[i]=e;else c.models.push(e);fs.writeFileSync(f,JSON.stringify(c));console.log('staged',e.id,e.modelUrl,i>=0?'(replaced)':'(new)');"
