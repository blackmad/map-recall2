#!/bin/zsh
# New lane worktree that shares node_modules and the aerial-tile cache with the main checkout.
#   scripts/worktrees/new.sh <branch> [dir] [port]
# Python needs nothing per worktree: scripts run under `uv run` with inline deps and uv's central cache.
#
# Copy-on-write checkout (disk hygiene, 2026-11-13): a plain `worktree add` writes a full 1.4-2 GB tree per lane, and
# ~70 lanes filled the disk. The tree is instead cloned (APFS clonefile, `cp -c`) from a reference checkout near main,
# then `reset --hard` rewrites only the files that differ from the lane's base. A lane costs megabytes until it edits.
# MAP_RECALL2_CLONE_REF picks the reference; NO_CLONE=1 falls back to a plain checkout.
set -eu
G=/usr/bin/git
ROOT=${MAP_RECALL2_ROOT:-/Users/blackmad/Code/map-recall2}
REF=${MAP_RECALL2_CLONE_REF:-/Users/blackmad/Code/map-recall2-worktrees/integrator-transvaal-20261031}
BRANCH=$1; DIR=${2:-/Users/blackmad/Code/map-recall2-worktrees/${BRANCH##*/}}; PORT=${3:-$((4300 + RANDOM % 600))}
BASE=${BASE:-origin/main}
EXISTING=$($G -C "$ROOT" worktree list --porcelain | awk -v b="branch refs/heads/$BRANCH" '$0=="worktree "substr($0,10){p=substr($0,10)} $0==b{print p}')
if [ -n "$EXISTING" ]; then
  echo "branch $BRANCH is already checked out at $EXISTING (port $(cat "$EXISTING/.worktree-port" 2>/dev/null || echo unset)); reuse it" >&2
  exit 2
fi
$G -C "$ROOT" fetch -q origin main || true
NC=(--no-checkout); [ "${NO_CLONE:-0}" = 1 ] && NC=()
if $G -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then $G -C "$ROOT" worktree add "${NC[@]}" "$DIR" "$BRANCH"
else $G -C "$ROOT" worktree add "${NC[@]}" --no-track -b "$BRANCH" "$DIR" "$BASE"; fi
if [ "${NO_CLONE:-0}" != 1 ]; then
  [ -d "$REF/.git" ] || [ -f "$REF/.git" ] || { echo "clone reference $REF is not a checkout; use NO_CLONE=1" >&2; exit 3; }
  for e in $($G -C "$DIR" ls-tree --name-only HEAD); do [ -e "$REF/$e" ] && cp -c -R "$REF/$e" "$DIR/"; done
  $G -C "$DIR" reset -q                        # index from HEAD
  $G -C "$DIR" update-index -q --refresh || true   # identical clones become up to date
  $G -C "$DIR" reset -q --hard                 # writes only the files that differ from the lane's base
  $G -C "$DIR" clean -fdxq                     # drop the reference's untracked and ignored files
fi
ln -sfn "$ROOT/node_modules" "$DIR/node_modules"
[ -d "$ROOT/.cache" ] && ln -sfn "$ROOT/.cache" "$DIR/.cache"
echo "$PORT" > "$DIR/.worktree-port"
echo "worktree $DIR on $BRANCH, dev port $PORT (PW_PORT=$PORT for Playwright)"
