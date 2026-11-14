#!/bin/zsh
# today | lane D1 staged | D1 staged + wall sample v2, rule-10 frames of the 7 pages + 2 Weteringschans rows (?world=live)
cd /Users/blackmad/Code/map-recall2-worktrees/d1-wall-colour-20261114
D=artifacts/d1-wall-colour
export PW_PORT=4452
for c in ${=CONDS:-today staged v2}; do
  lists=()
  for s in herengracht-even herengracht-odd keizersgracht-even keizersgracht-odd weteringschans; do lists+=("$D/lists/$s.json:$D/frames/$c/$s"); done
  if [ $c = today ]; then unset HOUSE_FRAMES_SPECS_DIR; else export HOUSE_FRAMES_SPECS_DIR=$D/extract-$c/house-specs; fi
  before=(); [ $c != today ] && before=(--before $D/frames/today)
  node --import tsx scripts/house-frames/frames.ts --lists ${(j:,:)lists} --rule10 --season winter --prefer-obliquity 30 --max-dist 60 --label $c --query '?world=live' --reuse-photos $before > $D/frames-$c.log 2>&1
  echo "RUN $c exit $?"
done
echo FRAMES-DONE
