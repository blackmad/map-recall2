#!/usr/bin/env bash
# Long driving sweeps, meant to run nightly (GitHub Actions:
# .github/workflows/nightly-driving.yml) or by hand before a release:
#
#   1. keyboard rides over every reported spot (real key presses, quiz on)
#   2. the driving harness, desktop and iPhone
#   3. the full bridge sweep (every bridge way, both directions)
#
# Each step's Playwright JSON report and a combined summary land in
# artifacts/nightly-driving/<date>/. The script runs every step even when one
# fails and exits non-zero if any did.
#
#   PW_PORT=4403 scripts/nightly-driving.sh          # private port, see CLAUDE.md
#   NIGHTLY_STEPS="keyboard harness" scripts/nightly-driving.sh
set -uo pipefail

cd "$(dirname "$0")/.."
stamp="$(date +%Y-%m-%d)"
out="artifacts/nightly-driving/${stamp}"
mkdir -p "$out"
steps="${NIGHTLY_STEPS:-keyboard harness bridges}"
export PW_PORT="${PW_PORT:-4403}"
status=0
declare -a results=()

run_step() {
  local name="$1"; shift
  local started ended code
  started="$(date +%s)"
  echo "== ${name}: $*" >&2
  PLAYWRIGHT_JSON_OUTPUT_NAME="${out}/${name}.json" "$@" --reporter=line,json >"${out}/${name}.log" 2>&1
  code=$?
  ended="$(date +%s)"
  [ "$code" -ne 0 ] && status=1
  results+=("{\"step\":\"${name}\",\"exit\":${code},\"seconds\":$((ended - started))}")
  echo "== ${name}: exit ${code} in $((ended - started)) s" >&2
}

for step in $steps; do
  case "$step" in
    keyboard)
      KEYBOARD_RIDE_ALL=1 run_step keyboard npx playwright test tests/e2e/keyboard-ride.spec.ts --project=desktop ;;
    harness)
      run_step harness npx playwright test tests/e2e/driving-harness.spec.ts ;;
    bridges)
      BRIDGE_SWEEP_ALL=1 BRIDGE_SWEEP_OUT="${out}/bridge-sweep-report.json" \
        run_step bridges npx playwright test tests/e2e/bridge-sweep.spec.ts --project=desktop ;;
    *) echo "unknown step: $step" >&2; status=1 ;;
  esac
done

# One summary: per-step exit codes plus the measured lines each spec logs
# (ride results, harness reports, the sweep's totals).
joined="$(IFS=,; echo "${results[*]}")"
node -e '
const fs = require("fs");
const [out, stamp, steps] = process.argv.slice(1);
const lines = (name, re) => {
  try { return fs.readFileSync(`${out}/${name}.log`, "utf8").split("\n").filter(l => re.test(l)).map(l => l.trim()); }
  catch { return []; }
};
const summary = {
  date: stamp,
  commit: require("child_process").execSync("git rev-parse HEAD").toString().trim(),
  steps: JSON.parse(`[${steps}]`),
  keyboardRides: lines("keyboard", /arrived=/),
  harness: lines("harness", /"pairs"|arrived|pinned|wedges/i).slice(0, 20),
  bridgeSweep: lines("bridges", /^\{"bridges"/),
};
fs.writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`${out}/summary.json`);
' "$out" "$stamp" "$joined"

exit "$status"
