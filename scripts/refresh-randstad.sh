#!/usr/bin/env bash
# Rebuild every Randstad city the pipeline supports.
#
# BBBike publishes exactly these four of the conurbation: Amsterdam, Rotterdam,
# Den Haag and Utrecht. The smaller Randstad cities (Leiden, Haarlem, Delft,
# Dordrecht, Almere, Amersfoort) have no BBBike extract, so they would need a
# different source before they can be added here.
#
# Each city is independent: one failing must not stop the rest, and each only
# publishes if its own build and checks pass. The exit code reports whether
# every city succeeded.
set -uo pipefail

failed=()
run_city() {
  local id="$1" name="$2" center="$3" bbbike="$4"
  echo "=== $id ==="
  if bash scripts/refresh-city-extract.sh "$id" "$name" "$center" "$bbbike"; then
    echo "=== $id ok ==="
  else
    echo "=== $id FAILED ===" >&2
    failed+=("$id")
  fi
}

run_city amsterdam Amsterdam       52.372851,4.8936    Amsterdam
run_city rotterdam Rotterdam       51.9225,4.47917     Rotterdam
run_city den-haag  "'s-Gravenhage" 52.0705,4.3007      DenHaag
run_city utrecht   Utrecht         52.0907374,5.1214201 Utrecht

if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Randstad refresh failed for: ${failed[*]}" >&2
  exit 1
fi
echo "Randstad refresh complete."
