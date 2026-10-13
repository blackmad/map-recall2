#!/bin/zsh
# New lane worktree that shares node_modules and the aerial-tile cache with the main checkout.
#   scripts/worktrees/new.sh <branch> [dir] [port]
# Python needs nothing per worktree: scripts run under `uv run` with inline deps and uv's central cache.
set -eu
G=/usr/bin/git
ROOT=${MAP_RECALL2_ROOT:-/Users/blackmad/Code/map-recall2}
BRANCH=$1; DIR=${2:-/Users/blackmad/Code/map-recall2-worktrees/${BRANCH##*/}}; PORT=${3:-$((4300 + RANDOM % 600))}
EXISTING=$($G -C "$ROOT" worktree list --porcelain | awk -v b="branch refs/heads/$BRANCH" '$0=="worktree "substr($0,10){p=substr($0,10)} $0==b{print p}')
if [ -n "$EXISTING" ]; then
  echo "branch $BRANCH is already checked out at $EXISTING (port $(cat "$EXISTING/.worktree-port" 2>/dev/null || echo unset)); reuse it" >&2
  exit 2
fi
if $G -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then $G -C "$ROOT" worktree add "$DIR" "$BRANCH"
else $G -C "$ROOT" worktree add -b "$BRANCH" "$DIR" main; fi
ln -sfn "$ROOT/node_modules" "$DIR/node_modules"
[ -d "$ROOT/.cache" ] && ln -sfn "$ROOT/.cache" "$DIR/.cache"
echo "$PORT" > "$DIR/.worktree-port"
echo "worktree $DIR on $BRANCH, dev port $PORT (PW_PORT=$PORT for Playwright)"
