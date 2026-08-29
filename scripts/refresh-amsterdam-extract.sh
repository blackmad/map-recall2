#!/usr/bin/env bash
set -euo pipefail

work_dir="$(mktemp -d /tmp/map-recall-amsterdam.XXXXXX)"
trap 'rm -rf "$work_dir"' EXIT

curl -L --fail --retry 3 -o "$work_dir/amsterdam.osm.pbf" \
  https://download.bbbike.org/osm/bbbike/Amsterdam/Amsterdam.osm.pbf

osmium tags-filter "$work_dir/amsterdam.osm.pbf" \
  w/waterway=canal,river,stream,drain,dock,ditch r/waterway=canal,river,stream,drain,dock,ditch \
  w/natural=water r/natural=water w/water=canal,river,basin,moat,pond,lake,reflecting_pool,oxbow \
  r/water=canal,river,basin,moat,pond,lake,reflecting_pool,oxbow w/landuse=basin \
  w/highway=primary,secondary,tertiary,living_street,residential,unclassified,service,busway \
  w/bridge=yes w/man_made=bridge nwr/place=square nwr/amenity=marketplace \
  nwr/leisure=park,garden,nature_reserve nwr/tourism=attraction,museum,viewpoint,monument,gallery \
  nwr/historic nwr/amenity=theatre,arts_centre,townhall,place_of_worship \
  n/natural=tree w/natural=tree_row \
  -o "$work_dir/features.osm.pbf"

osmium export "$work_dir/features.osm.pbf" -o "$work_dir/features.geojson"
osmium tags-filter "$work_dir/amsterdam.osm.pbf" \
  wr/building:colour wr/building:color wr/building:material \
  wr/roof:colour wr/roof:color wr/roof:material \
  -o "$work_dir/building-appearance.osm.pbf"
osmium export --add-unique-id=type_id "$work_dir/building-appearance.osm.pbf" -o "$work_dir/building-appearance.geojson"
osmium tags-filter "$work_dir/amsterdam.osm.pbf" r/name=Amsterdam -o "$work_dir/boundaries.osm.pbf"
osmium export "$work_dir/boundaries.osm.pbf" -o "$work_dir/boundaries.geojson"
osmium tags-filter "$work_dir/amsterdam.osm.pbf" r/boundary=place -o "$work_dir/place-boundaries.osm.pbf"
osmium export "$work_dir/place-boundaries.osm.pbf" -o "$work_dir/place-boundaries.geojson"

npm run build:amsterdam -- "$work_dir/features.geojson" "$work_dir/boundaries.geojson" "$work_dir/place-boundaries.geojson"
npx tsx scripts/build-osm-building-appearance.ts "$work_dir/building-appearance.geojson"
npx tsx scripts/build-osm-trees.ts "$work_dir/features.geojson" public/data/extracts/amsterdam/trees.json
npm run enrich:amsterdam
