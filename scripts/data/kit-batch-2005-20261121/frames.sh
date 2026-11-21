#!/bin/bash
# Today and staged frames for one list, one browser run at a time (lane kit-batch-2005-20261121).
#   bash scripts/data/kit-batch-2005-20261121/frames.sh <list.json> <tag> [port]
# today: the committed world; new: STAGED_CANAL_DIR + the staged signature bundle (stage.sh, stage-bundle.sh). Both ?world=live.
L=$1; T=$2; P=${3:-4851}
rm -rf artifacts/kit-batch-2005/today-$T artifacts/kit-batch-2005/new-$T
PW_PORT=$P npm run -s house:frames -- --list $L --out artifacts/kit-batch-2005/today-$T --label before --reuse-photos --query '?world=live' > artifacts/kit-batch-2005/today-$T.log 2>&1
echo "today done $?"
BUNDLES_DIR=$PWD/artifacts/kit-batch-2005/bundles STAGED_CANAL_DIR=$PWD/artifacts/kit-batch-2005/staged PW_PORT=$P npm run -s house:frames -- --list $L --out artifacts/kit-batch-2005/new-$T --label after --reuse-photos --query '?world=live' > artifacts/kit-batch-2005/new-$T.log 2>&1
echo "new done $?"
echo FRAMES_DONE
