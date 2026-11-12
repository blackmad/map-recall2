#!/bin/bash
# Install the browser queue and the pre-push hook from this checkout (docs/browser-queue.md). The integrator's step.
#   bash scripts/browser-queue/install.sh            /tmp/canal-pw.sh and <common git dir>/hooks/pre-push
#   bash scripts/browser-queue/install.sh --check    syntax-check both and show what would change, install nothing
# Atomic: each file is written beside its destination and then mv'd over it, never edited in place (a running bash
# reads its script lazily; editing /tmp/canal-pw.sh in place broke every waiting wrapper on 2026-11-12). The previous
# file is kept as <dest>.bak-<yyyymmddHHMM>. Destinations can be overridden (tests): CANAL_PW_INSTALL_TO, HOOKS_DIR.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
G=/usr/bin/git
PW_DEST=${CANAL_PW_INSTALL_TO:-/tmp/canal-pw.sh}
HOOKS=${HOOKS_DIR:-$($G -C "$HERE" rev-parse --path-format=absolute --git-common-dir)/hooks}
CHECK=0; [ "${1:-}" = --check ] && CHECK=1

bash -n "$HERE/canal-pw.sh"
sh -n "$HERE/pre-push"

put() { # src dest
  local src=$1 dest=$2 tmp
  if [ -f "$dest" ] && cmp -s "$src" "$dest"; then echo "unchanged $dest"; return 0; fi
  if [ $CHECK = 1 ]; then echo "would install $dest"; [ -f "$dest" ] && diff -u "$dest" "$src" | head -40; return 0; fi
  mkdir -p "$(dirname "$dest")"
  [ -f "$dest" ] && cp -p "$dest" "$dest.bak-$(date +%Y%m%d%H%M)"
  tmp=$(mktemp "$dest.new.XXXXXX")
  cp "$src" "$tmp"; chmod 755 "$tmp"
  mv -f "$tmp" "$dest"
  echo "installed $dest"
}
put "$HERE/canal-pw.sh" "$PW_DEST"
put "$HERE/pre-push" "$HOOKS/pre-push"
[ $CHECK = 1 ] || "$PW_DEST" --status
