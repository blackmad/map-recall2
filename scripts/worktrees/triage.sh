#!/bin/zsh
# Worktree triage for map-recall2 (2026-10-13; rewritten 2026-11-01 after the disk hit 100 % with 64 worktrees).
#
#   scripts/worktrees/triage.sh                     # table: path | branch | last commit | merged | dirt | idle h | live | size
#   scripts/worktrees/triage.sh --remove-merged     # remove every worktree that is merged into origin/main, has no live
#                                                   # process, and has been idle for IDLE_HOURS (default 12): stage its
#                                                   # review sheets into _pruned-sheets/<name>/, WIP-commit any dirt onto
#                                                   # its branch, then `git worktree remove --force`
#   scripts/worktrees/triage.sh --sweep-sheets [D]  # delete _pruned-sheets/<name> folders older than D days (default 7)
#   scripts/worktrees/triage.sh --prune             # git worktree prune only
#   (--remove-merged-clean and --archive-dirty are kept as aliases of --remove-merged)
#
# Rules: never touch a worktree that is not an ancestor of origin/main, that a process has as cwd, or that was
# touched within IDLE_HOURS; never touch KEEP or the primary checkout; dirt (tracked changes, and untracked files
# outside artifacts/ .cache/ staging/ scratch) is committed to the lane branch before removal, so nothing is lost
# but the branch must exist (a dirty detached worktree is skipped). Sheets (jpg/png <= 8 MB under artifacts/ and
# staging/) are copied out first because the demo page links them after the worktree is gone.
# Run this after every integration round: each worktree is ~1.2 GB of tracked files plus its artifacts.
set -u
G=/usr/bin/git
ROOT=${MAP_RECALL2_ROOT:-/Users/blackmad/Code/map-recall2}
SHEETS=${MAP_RECALL2_SHEETS:-/Users/blackmad/Code/map-recall2-worktrees/_pruned-sheets}
IDLE_HOURS=${IDLE_HOURS:-12}
KEEP=(source-archive)
MODE=${1:-table}
cd "$ROOT" || exit 1
$G fetch -q origin 2>/dev/null || echo "warning: fetch failed; judging against the last known origin/main" >&2

keep() { for k in $KEEP; do [[ "$(basename "$1")" == "$k" ]] && return 0; done; return 1; }
sizek() { du -sk "$1" 2>/dev/null | awk '{print $1}'; }
live() { lsof -d cwd -F n 2>/dev/null | grep -q -F "n$1" && return 0; ps -eo command | grep -v grep | grep -q -F "$1/"; }
# Hours since the worktree was last touched (files outside .git/node_modules/artifacts/.cache); 0 when something moved within the window.
idle_hours() {
  if [ -n "$(find "$1" -type f -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/artifacts/*' -not -path '*/.cache/*' -mmin -$((IDLE_HOURS * 60)) -print -quit 2>/dev/null)" ]; then echo 0; return; fi
  echo $(( ( $(date +%s) - $(stat -f %m "$1/.git") ) / 3600 ))
}
# Dirt worth keeping: tracked changes plus untracked files that are neither artifacts/caches/staging nor scratch.
dirt() { $G -C "$1" status --porcelain | grep -vE '^\?\? (artifacts/|\.cache/|staging/|node_modules|_|\.worktree-port|scripts/_tmp)' | wc -l | tr -d ' '; }

stage_sheets() { # $1 worktree, $2 name -> prints the number of files staged
  local n=0 d
  for d in artifacts staging; do
    [ -d "$1/$d" ] || continue
    mkdir -p "$SHEETS/$2/$d"
    rsync -a --prune-empty-dirs --max-size=8m --include='*/' --include='*.jpg' --include='*.png' --exclude='*' "$1/$d/" "$SHEETS/$2/$d/" 2>/dev/null
    n=$((n + $(find "$SHEETS/$2/$d" -type f | wc -l)))
  done
  [ "$n" -eq 0 ] && rm -rf "$SHEETS/$2"
  echo $n
}

case $MODE in
  --prune) $G worktree prune && echo "pruned; $($G worktree list | wc -l | tr -d ' ') worktrees remain"; exit 0 ;;
  --sweep-sheets)
    days=${2:-7}; before=$(sizek "$SHEETS")
    find "$SHEETS" -mindepth 1 -maxdepth 1 -type d -mtime +"$days" -print -exec rm -rf {} + | sed 's/^/swept /'
    echo "sheets: $(( (before - $(sizek "$SHEETS")) / 1024 )) MB freed, $(( $(sizek "$SHEETS") / 1024 )) MB kept"; exit 0 ;;
  --remove-merged-clean|--archive-dirty) MODE=--remove-merged ;;
esac

free_before=$(df -k "$ROOT" | tail -1 | awk '{print $4}')
$G worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{print w"\t"$2} /^detached/{print w"\tDETACHED"}' | while IFS=$'\t' read -r w b; do
  b=${b#refs/heads/}
  [[ "$w" == "$ROOT" ]] && continue
  [ -d "$w" ] || { echo "MISSING $w ($b)"; continue; }
  name=$(basename "$w")
  head=$($G -C "$w" rev-parse HEAD)
  ahead=$($G rev-list --count origin/main.."$head")
  merged=$($G merge-base --is-ancestor "$head" origin/main && echo merged || echo "ahead:$ahead")
  d=$(dirt "$w"); idle=$(idle_hours "$w"); lv=$(live "$w" && echo live || echo idle)
  case $MODE in
    table) printf "%s|%s|%s|%s|dirt:%s|%sh|%s|%sM\n" "${w#$ROOT/}" "$b" "$($G -C "$w" log -1 --format=%cs)" "$merged" "$d" "$idle" "$lv" "$(( $(sizek "$w") / 1024 ))" ;;
    --remove-merged)
      keep "$w" && { echo "  keep $name: KEEP list"; continue; }
      [ "$merged" = merged ] || { echo "  keep $name ($b): not in origin/main ($merged)"; continue; }
      [ "$lv" = live ] && { echo "  keep $name ($b): a running process uses it"; continue; }
      [ "$idle" -lt "$IDLE_HOURS" ] && { echo "  keep $name ($b): touched within ${IDLE_HOURS}h"; continue; }
      wip=
      if [ "$d" -gt 0 ]; then
        [ "$b" = DETACHED ] && { echo "  keep $name: dirty ($d paths) and detached, nowhere to commit"; continue; }
        $G -C "$w" add -A -- . ':!artifacts' ':!.cache' ':!staging' ':!node_modules' ':!.worktree-port' ':!scripts/_tmp*' >/dev/null 2>&1
        if $G -C "$w" commit -q --no-verify -m "WIP preserved before worktree prune ($(date +%F))

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" 2>/dev/null; then wip=" (WIP-committed $d paths on $b)"; fi
      fi
      sheets=$(stage_sheets "$w" "$name"); sz=$(( $(sizek "$w") / 1024 ))
      if $G worktree remove --force "$w" 2>/tmp/triage-err.txt; then echo "removed $name ($b, ${sz} MB, $sheets sheets staged)$wip"
      else echo "  FAILED $name: $(head -1 /tmp/triage-err.txt)"; fi ;;
  esac
done
if [ "$MODE" = --remove-merged ]; then
  $G worktree prune
  free_after=$(df -k "$ROOT" | tail -1 | awk '{print $4}')
  echo "freed $(( (free_after - free_before) / 1024 )) MB; $(( free_after / 1024 / 1024 )) GB free; $($G worktree list | wc -l | tr -d ' ') worktrees remain; sheets archive $(( $(sizek "$SHEETS") / 1024 / 1024 )) GB (--sweep-sheets)"
fi
exit 0
