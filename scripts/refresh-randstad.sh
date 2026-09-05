#!/usr/bin/env bash
# Rebuild every Randstad city the pipeline supports.
#
#   npm run refresh:randstad
#
# Amsterdam and Utrecht come from cached BBBike city extracts. Rotterdam and
# Den Haag share a cached Zuid-Holland province PBF; each city's cut of that
# file is also cached. Wikimedia/Wikipedia responses live in .cache/wikimedia/,
# and English ledes reuse scripts/english-translations.json.
#
# Environment:
#   REFRESH_FORCE_DOWNLOAD=1  re-fetch OSM source PBFs
#   REFRESH_FORCE_CUT=1       redo municipality cuts from a wide PBF
#   REFRESH_OFFLINE=1         fail on a missing OSM cache instead of downloading
#
# Each city is independent: one failing must not stop the rest, and each only
# publishes if its own build and checks pass. The exit code reports whether
# every city succeeded.
set -uo pipefail

ZUID_HOLLAND="https://download.geofabrik.de/europe/netherlands/zuid-holland-latest.osm.pbf"

echo "Randstad refresh — OSM sources from .cache/osm-source/ when present"
echo "  FORCE_DOWNLOAD=${REFRESH_FORCE_DOWNLOAD:-0}  FORCE_CUT=${REFRESH_FORCE_CUT:-0}  OFFLINE=${REFRESH_OFFLINE:-0}"

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
