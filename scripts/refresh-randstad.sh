#!/usr/bin/env bash
# Rebuild every Randstad city the pipeline supports.
#
# Amsterdam and Utrecht come from their BBBike city extracts, which contain
# their whole municipality. Rotterdam and Den Haag come from the Zuid-Holland
# province file instead: BBBike's Rotterdam bbox cuts the municipality relation,
# and the fourth argument now accepts any PBF URL, so the smaller Randstad
# cities (Leiden, Haarlem, Delft, Dordrecht, Almere, Amersfoort) can be added
# the same way once someone picks their centres.
#
# Each city is independent: one failing must not stop the rest, and each only
# publishes if its own build and checks pass. The exit code reports whether
# every city succeeded.
set -uo pipefail

ZUID_HOLLAND="https://download.geofabrik.de/europe/netherlands/zuid-holland-latest.osm.pbf"

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
# Rotterdam and Den Haag are built from the shared Zuid-Holland province file,
# cached between them. BBBike's Rotterdam bbox stops at lon 4.18 and cuts the
# municipality relation in half, and BBBike has no complete alternative.
run_city rotterdam Rotterdam       51.9225,4.47917     "$ZUID_HOLLAND"
run_city den-haag  "Den Haag"      52.0705,4.3007      "$ZUID_HOLLAND"
run_city utrecht   Utrecht         52.0907374,5.1214201 Utrecht

if [[ ${#failed[@]} -gt 0 ]]; then
  echo "Randstad refresh failed for: ${failed[*]}" >&2
  exit 1
fi
echo "Randstad refresh complete."
