#!/bin/zsh
# Sparse lane worktree of the private source-data repo (disk hygiene, 2026-11-10).
#   scripts/worktrees/new-source-data.sh <branch> <dir-in-repo> [more dirs...]
# Checks out only the named top-level directories (cone mode) plus root files, so a lane that archives
# into e.g. experiments/jev-j2/ costs megabytes, not the 20 GB of a full checkout (J1 and J2 each made one).
# The worktree lands at ~/Code/map-recall2-source-data-<branch tail>; the integrator commits and pushes it,
# and the disk sweep removes it once it is clean and pushed.
set -eu
G=/usr/bin/git
SRC=${MAP_RECALL2_SOURCE_DATA:-$HOME/Code/map-recall2-source-data}
[ $# -ge 2 ] || { sed -n 2,7p "$0"; exit 2; }
BRANCH=$1; shift
DIR=$HOME/Code/map-recall2-source-data-${BRANCH##*/}
[ -e "$DIR" ] && { echo "$DIR exists; reuse it" >&2; exit 2; }
$G -C "$SRC" fetch -q origin main
if $G -C "$SRC" show-ref --verify --quiet "refs/heads/$BRANCH"; then $G -C "$SRC" worktree add --no-checkout "$DIR" "$BRANCH"
else $G -C "$SRC" worktree add --no-checkout -b "$BRANCH" "$DIR" origin/main; fi
$G -C "$DIR" sparse-checkout set --cone "$@"
$G -C "$DIR" checkout -q
echo "sparse source-data worktree $DIR on $BRANCH: $* ($(du -sh "$DIR" | cut -f1))"
