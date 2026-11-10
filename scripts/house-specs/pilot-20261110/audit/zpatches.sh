#!/bin/zsh
# usage: zpatches.sh <face>  -> audit the staged chunk and list tight/coplanar patches
f=$1; O=artifacts/house-line/r3-audit/$f; rm -rf $O
node --max-old-space-size=8192 --import tsx scripts/audit-glb-quality.ts --file=staging/block-face/$f/chunk.glb --write --out=$O --quiet >/dev/null 2>&1
python3 - $O/models/chunk.json <<'PY'
import json,sys
g=json.load(open(sys.argv[1]))['geometry']
for p in g['zfight']['patches']:
  if p.get('tight') or not p.get('near'):
    print('tight' if p.get('tight') else 'copl ', p['orientation'], p['materials'], p['area'], 'gap',p['gap'], 'min',[round(x,2) for x in p['min']],'max',[round(x,2) for x in p['max']], 'n',[round(x,2) for x in p['normal']])
PY
