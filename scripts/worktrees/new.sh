#!/bin/zsh
# New lane worktree that shares node_modules and the aerial-tile cache with the main checkout.
#   scripts/worktrees/new.sh <branch> [dir] [port]
# Python needs nothing per worktree: scripts run under `uv run` with inline deps and uv's central cache.
set -eu
G=/usr/bin/git
ROOT=${MAP_RECALL2_ROOT:-/Users/blackmad/Code/map-recall2}
BRANCH=$1; DIR=${2:-/Users/blackmad/Code/map-recall2-worktrees/${BRANCH##*/}}; PORT=${3:-$((4300 + RANDOM % 600))}
$G -C "$ROOT" worktree add -b "$BRANCH" "$DIR" main 2>/dev/null || $G -C "$ROOT" worktree add "$DIR" "$BRANCH"
ln -sfn "$ROOT/node_modules" "$DIR/node_modules"
[ -d "$ROOT/.cache" ] && ln -sfn "$ROOT/.cache" "$DIR/.cache"
echo "$PORT" > "$DIR/.worktree-port"
echo "worktree $DIR on $BRANCH, dev port $PORT (PW_PORT=$PORT for Playwright)"
