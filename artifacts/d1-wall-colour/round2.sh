#!/bin/zsh
# round 2: merge the belt capture shards, restage belt + AH07 with v2 round 2 (dark veto, chroma ceiling), build the staged
# extract, then the v3 rule-10 frames (house:frames is not wrapped; it queues itself)
set -e
cd /Users/blackmad/Code/map-recall2-worktrees/d1-wall-colour-20261114
D=artifacts/d1-wall-colour
B=/Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114/artifacts/describer-d1/belt-20261114
S=/Users/blackmad/Code/map-recall2-worktrees/_pruned-sheets/d1-belt-20261114/staged-belt-20261114
python3 $D/merge-shards.py $D/captures-belt.json
rm -rf $D/staged-belt-v3 $D/staged-ah07-v3 $D/x-v3 $D/extract-v3
WALL_SAMPLE=2 node --import tsx scripts/house-specs/wall-sample/restage.ts --staged $S --answers $B/answers --cuts $B/cuts/cuts.json --captures $D/captures-belt.json --out $D/staged-belt-v3
WALL_SAMPLE=2 node --import tsx scripts/house-specs/wall-sample/restage.ts --staged artifacts/describer-d1/staged-ah07 --answers artifacts/describer-d1/answers-ah07 --cuts artifacts/describer-d1/cuts-ah07/cuts.json --captures $D/captures-ah07.json --out $D/staged-ah07-v3
mkdir -p $D/x-v3 && cp $D/staged-belt-v3/03*.json $D/staged-ah07-v3/03*.json $D/x-v3/
node --import tsx scripts/house-specs/build-house-specs.ts --extra-specs $D/x-v3 > $D/build-v3.log 2>&1
mkdir -p $D/extract-v3 && mv public/data/extracts/amsterdam/staging/house-specs public/data/extracts/amsterdam/staging/house-specs.coverage.json $D/extract-v3/ && rm -f public/data/extracts/amsterdam/staging/house-specs.templates.json
echo STAGED-V3
CONDS=v3 $D/run-frames.sh
