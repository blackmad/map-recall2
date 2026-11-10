#!/bin/bash
# House line H3 (docs/house-line.md section 3): house:publish for everything staged, with a log, for the integrator to run
# by hand or from cron when they choose (no cron is installed by the repo).
#
#   scripts/house-specs/nightly.sh [house:publish flags]      e.g. --allow-extra <ids>, --full-bake, --archive <dir>
#   HOUSE_BATCH=nightly-20261110 scripts/house-specs/nightly.sh
#
# Exits 0 when nothing was staged or the batch published; non-zero (the house:publish code) on any gate failure, with the
# last lines of the log on stderr. The full log is artifacts/house-specs/logs/<batch>-nightly.log; per-step logs sit beside it.
set -u
cd "$(dirname "$0")/../.." || exit 2
batch="${HOUSE_BATCH:-nightly-$(date +%Y%m%d-%H%M)}"
mkdir -p artifacts/house-specs/logs
log="artifacts/house-specs/logs/${batch}-nightly.log"
if ! ls artifacts/house-specs/staging/*.json >/dev/null 2>&1; then
  echo "nightly $batch: nothing staged" | tee "$log"
  exit 0
fi
echo "nightly $batch: $(ls artifacts/house-specs/staging/*.json | wc -l | tr -d ' ') staged specs, log $log"
npm run house:publish -- --batch "$batch" "$@" > "$log" 2>&1
code=$?
if [ "$code" -ne 0 ]; then
  echo "nightly $batch: house:publish FAILED (exit $code); the working tree is as the batch left it" >&2
  tail -40 "$log" >&2
else
  grep -E '^(===|HISTORY:|WHAT.S NEW:)' "$log"
fi
exit "$code"
