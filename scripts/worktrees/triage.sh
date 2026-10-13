#!/bin/zsh
# Worktree triage for map-recall2 (see TODO/HISTORY 2026-10-13).
#
#   scripts/worktrees/triage.sh                    # table: path | branch | last commit | dirty | merged | node_modules | size
#   scripts/worktrees/triage.sh --remove-merged-clean   # git worktree remove every merged+clean worktree (keeps KEEP list)
#   scripts/worktrees/triage.sh --archive-dirty         # merged+dirty: WIP-commit tracked changes, keep *-footprints/*-research/*-spec json,
#                                                       # delete _-prefixed scratch, then remove the worktree
#   scripts/worktrees/triage.sh --prune                 # git worktree prune only
#
# Rules: never touch an unmerged worktree; never touch KEEP; a tracked diff is always committed before removal
# (branch keeps it); untracked files that are not scratch and not evidence JSON block removal and are listed.
set -u
G=/usr/bin/git
ROOT=${MAP_RECALL2_ROOT:-/Users/blackmad/Code/map-recall2}
KEEP=(integrator source-archive block-face facade-compare backlog-20261011 drop-maplibre)
MODE=${1:-table}
cd "$ROOT" || exit 1

keep() { for k in $KEEP; do [[ "$1" == *"$k"* ]] && return 0; done; return 1; }
sizek() { du -sk "$1" 2>/dev/null | awk '{print $1}'; }

$G worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{print w"\t"$2} /^detached/{print w"\tDETACHED"}' | while IFS=$'\t' read -r w b; do
  b=${b#refs/heads/}
  [[ "$w" == "$ROOT" ]] && continue
  [ -d "$w" ] || { echo "MISSING $w ($b)"; continue; }
  dirty=$($G -C "$w" status --porcelain | wc -l | tr -d ' ')
  tracked=$($G -C "$w" status --porcelain | grep -v '^??' | wc -l | tr -d ' ')
  head=$($G -C "$w" rev-parse HEAD)
  ahead=$($G rev-list --count main.."$head")
  merged=$([ "$ahead" = 0 ] && echo merged || echo "ahead:$ahead")
  date=$($G -C "$w" log -1 --format=%cs)
  nm=$([ -L "$w/node_modules" ] && echo link || { [ -d "$w/node_modules" ] && echo dir || echo none; })
  case $MODE in
    table) printf "%s|%s|%s|dirty:%s|%s|nm:%s|%sM\n" "${w#$ROOT/}" "$b" "$date" "$dirty" "$merged" "$nm" "$(( $(sizek "$w") / 1024 ))" ;;
    --remove-merged-clean)
      keep "$w" && continue
      [ "$merged" = merged ] && [ "$dirty" = 0 ] && { echo "remove $w ($b)"; $G worktree remove --force "$w"; } ;;
    --archive-dirty)
      keep "$w" && continue
      [ "$merged" = merged ] && [ "$dirty" != 0 ] || continue
      if [ "$tracked" != 0 ]; then
        $G -C "$w" add -u && $G -C "$w" commit -q -m "WIP: archive uncommitted worktree changes before removal ($(date +%F))

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && echo "wip-commit $b"
      fi
      $G -C "$w" status --porcelain | grep '^??' | awk '{print $2}' | while read -r f; do
        base=$(basename "$f")
        case "$base" in
          _*|*.tmp) rm -rf "$w/$f"; echo "  scratch rm $f" ;;
          *-footprints.json|*-research.json|*-spec.json|*-elevations.json)
            $G -C "$w" add "$f"; $G -C "$w" commit -q -m "WIP: keep $base

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; echo "  kept $f" ;;
          *) echo "  BLOCK $b: untracked $f" ;;
        esac
      done
      if [ "$($G -C "$w" status --porcelain | wc -l | tr -d ' ')" = 0 ]; then echo "remove $w ($b)"; $G worktree remove --force "$w"; else echo "  left $w (untracked files above)"; fi ;;
  esac
done
[ "$MODE" != table ] && $G worktree prune && echo "pruned; $($G worktree list | wc -l | tr -d ' ') worktrees remain"
exit 0
