#!/bin/bash
# Today and staged frames for one list, one browser run at a time (lane kit-batch-2005b-20261122).
#   bash scripts/data/kit-batch-2005b-20261122/frames.sh <list.json> <tag> [port]
# today: the committed world; new: STAGED_CANAL_DIR + the staged signature bundle (stage.sh, stage-bundle.sh). Both ?world=live.
L=$1; T=$2; P=${3:-4872}
rm -rf artifacts/kit-batch-2005b/today-$T artifacts/kit-batch-2005b/new-$T
PW_PORT=$P npm run -s house:frames -- --list $L --out artifacts/kit-batch-2005b/today-$T --label before --reuse-photos --query '?world=live' > artifacts/kit-batch-2005b/today-$T.log 2>&1
echo "today done $?"
BUNDLES_DIR=$PWD/artifacts/kit-batch-2005b/bundles STAGED_CANAL_DIR=$PWD/artifacts/kit-batch-2005b/staged PW_PORT=$P npm run -s house:frames -- --list $L --out artifacts/kit-batch-2005b/new-$T --label after --reuse-photos --query '?world=live' > artifacts/kit-batch-2005b/new-$T.log 2>&1
echo "new done $?"
echo FRAMES_DONE
