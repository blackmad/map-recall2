#!/usr/bin/env bash
set -euo pipefail

city_id="${1:-amsterdam}"
city_name="${2:-Amsterdam}"
city_center="${3:-52.372851,4.8936}"
bbbike_name="${4:-$city_name}"
source_pbf="${5:-}"
output_dir="public/data/extracts/$city_id"
work_dir="$(mktemp -d "/tmp/map-recall-${city_id}.XXXXXX")"
build_dir="$work_dir/output"
trap 'rm -rf "$work_dir"' EXIT

if [[ -n "$source_pbf" ]]; then
  if [[ ! -s "$source_pbf" ]]; then
    echo "Supplied PBF does not exist or is empty: $source_pbf" >&2
    exit 2
  fi
  city_pbf="$source_pbf"
else
  city_pbf="$work_dir/city.osm.pbf"
  curl -L --fail --retry 3 -o "$city_pbf" \
    "https://download.bbbike.org/osm/bbbike/${bbbike_name}/${bbbike_name}.osm.pbf"
fi

osmium tags-filter "$city_pbf" \
  w/waterway=canal,river,stream,drain,dock,ditch r/waterway=canal,river,stream,drain,dock,ditch \
  w/natural=water r/natural=water w/water=canal,river,basin,moat,pond,lake,reflecting_pool,oxbow \
  r/water=canal,river,basin,moat,pond,lake,reflecting_pool,oxbow w/landuse=basin \
  w/highway=motorway,trunk,primary,secondary,tertiary,motorway_link,trunk_link,primary_link,secondary_link,tertiary_link,living_street,residential,unclassified,service,busway \
  w/bridge=yes w/man_made=bridge nwr/place=square nwr/amenity=marketplace \
  nwr/leisure=park,garden,nature_reserve nwr/tourism=attraction,museum,viewpoint,monument,gallery,zoo \
  nwr/historic nwr/amenity=theatre,arts_centre,community_centre,townhall,place_of_worship \
  nwr/amenity=cinema,library,university,college,music_venue \
  nwr/amenity=restaurant,cafe,pub,bar \
  nwr/shop n/natural=tree w/natural=tree_row \
  -o "$work_dir/features.osm.pbf"

osmium export "$work_dir/features.osm.pbf" -o "$work_dir/features.geojson"
osmium tags-filter "$city_pbf" \
  wr/building:colour wr/building:color wr/building:material \
  wr/building:facade:colour wr/building:facade:color wr/facade:colour wr/facade:color \
  wr/roof:colour wr/roof:color wr/roof:material \
  -o "$work_dir/building-appearance.osm.pbf"
osmium export --add-unique-id=type_id "$work_dir/building-appearance.osm.pbf" -o "$work_dir/building-appearance.geojson"
osmium tags-filter "$city_pbf" "r/name=$city_name" -o "$work_dir/boundaries.osm.pbf"
osmium export "$work_dir/boundaries.osm.pbf" -o "$work_dir/boundaries.geojson"
osmium tags-filter "$city_pbf" r/boundary=place -o "$work_dir/place-boundaries.osm.pbf"
osmium export "$work_dir/place-boundaries.osm.pbf" -o "$work_dir/place-boundaries.geojson"

node --import tsx scripts/build-amsterdam-extract.ts "$work_dir/features.geojson" "$work_dir/boundaries.geojson" \
  "$work_dir/place-boundaries.geojson" "$build_dir" "$city_id" "$city_name" "$city_center"
node --import tsx scripts/build-osm-building-appearance.ts "$work_dir/building-appearance.geojson" "$build_dir/buildings-colored.geojson"
node --import tsx scripts/build-osm-trees.ts "$work_dir/features.geojson" "$build_dir/trees.json"
node --import tsx scripts/enrich-amsterdam-wikimedia.ts "--directory=$build_dir"
node --import tsx scripts/enrich-amsterdam-wikipedia-extracts.ts "--directory=$build_dir"
node --import tsx scripts/enrich-city-profile.ts "--directory=$build_dir" "--name=$city_name"
node --import tsx scripts/enrich-brand-identifiers.ts "--directory=$build_dir"
node --import tsx scripts/apply-wikimedia-image-overrides.ts "$build_dir"
# Everything keyed on bridge ids has to be built from the bridges.json that was
# just written, in the same run. Skipping this is how a rebuild renumbered every
# bridge and orphaned the crossing index: nothing crashed, and 229 bridges
# silently lost the water beneath them.
node --import tsx scripts/build-bridge-crossings.ts "--directory=$build_dir" --publish
node --import tsx scripts/build-bridge-railways.ts "--directory=$build_dir" --publish
node --import tsx scripts/build-bridge-distractors.ts "--directory=$build_dir" --publish

node --import tsx scripts/check-city-extract.ts "$build_dir" "$city_id"

# Publish only after every build and enrichment stage succeeds. A transient
# Wikimedia or download failure must not replace a working city with a partly
# enriched one.
mkdir -p "$output_dir"
cp "$build_dir"/* "$output_dir"/
