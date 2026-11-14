#!/bin/zsh
# today | judged rule-10 frames of every page list (lane d1-colour-judged). house:frames is not wrapped; it queues itself.
cd /Users/blackmad/Code/map-recall2-worktrees/d1-colour-judged-20261114
D=artifacts/d1-colour-judged
export PW_PORT=4365
C=$1
lists=()
for p in $(python3 -c "import json;print(' '.join(i['page'] for i in json.load(open('$D/lists/index.json'))))"); do lists+=("$D/lists/$p.json:$D/frames/$C/$p"); done
if [ $C = today ]; then unset HOUSE_FRAMES_SPECS_DIR; before=(); else export HOUSE_FRAMES_SPECS_DIR=$D/extract/house-specs; before=(--before $D/frames/today); fi
node --import tsx scripts/house-frames/frames.ts --lists ${(j:,:)lists} --rule10 --season winter --prefer-obliquity 30 --label $C --query '?world=live' --reuse-photos $before > $D/frames-$C.log 2>&1
echo "RUN $C exit $?"
