#!/bin/zsh
# Lane WC (#384), review rule 8: the players' world for each wall-exposure setting. Per condition, a copy of the published
# world-v1 (cells, strings, index, tiles) whose index takes the current code's global hash, then `world:compile --changed`
# with the staged house-specs extract (HOUSE_SPECS_DIR=staging/house-specs) and the condition's env: only the tiles whose
# staged specs differ are rebuilt, against the published string table. Serve one with WORLD_DIR=<out>/<cond>.
#   compile-conditions.sh <out root> <globalHash> <cond=ENV=VAL[,ENV=VAL]> ...     e.g. sx-norm=WALL_EXPOSURE=norm
set -eu
OUT=$1 GH=$2; shift 2
PUB=public/data/extracts/amsterdam/world-v1
for spec in "$@"; do
  c=${spec%%=*}; envs=${spec#*=}; [ "$envs" = "$spec" ] && envs=''
  d=$OUT/$c; rm -rf $d; mkdir -p $d
  cp -R $PUB/cells $PUB/strings.bin $PUB/tiles.json $d/
  python3 -c "import json,sys;p='$PUB/index.json';i=json.load(open(p));i['globalHash']='$GH';json.dump(i,open('$d/index.json','w'))"
  echo "== $c ($envs)"
  env HOUSE_SPECS_DIR=staging/house-specs ${(s:,:)envs} nice -n 10 node --max-old-space-size=12000 --import tsx scripts/world/compile.ts --changed --against=none --out=$d 2>&1 | grep -E -- '--changed|cellsWritten|Error|error' | head -5
done
