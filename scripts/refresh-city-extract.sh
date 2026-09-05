#!/usr/bin/env bash
# Rebuild one city's versioned extract under public/data/extracts/<id>/.
#
# Downloads land in .cache/osm-source/ and are reused across cities and runs.
# Wikimedia / Wikipedia enrichments reuse .cache/wikimedia/. English ledes reuse
# scripts/english-translations.json. Set REFRESH_FORCE_DOWNLOAD=1 to re-fetch
# OSM sources; REFRESH_FORCE_CUT=1 to redo a municipality cut from a wide PBF;
# REFRESH_OFFLINE=1 to fail instead of downloading on a cache miss.
set -euo pipefail

city_id="${1:-amsterdam}"
city_name="${2:-Amsterdam}"
city_center="${3:-52.372851,4.8936}"
bbbike_name="${4:-$city_name}"
source_pbf="${5:-}"
output_dir="public/data/extracts/$city_id"
work_dir="$(mktemp -d "/tmp/map-recall-${city_id}.XXXXXX")"
build_dir="$work_dir/output"
cache_dir=".cache/osm-source"
mkdir -p "$cache_dir" "$build_dir"
trap 'rm -rf "$work_dir"' EXIT

source_mtime() {
  local file="$1"
  if stat -f %m "$file" >/dev/null 2>&1; then
    stat -f %m "$file"
  else
    stat -c %Y "$file"
  fi
}

# Fetch `$url` into `$dest` unless a usable cache already exists.
download_cached() {
  local url="$1"
  local dest="$2"
  if [[ -s "$dest" && "${REFRESH_FORCE_DOWNLOAD:-}" != 1 ]]; then
    echo "Using cached source $dest"
    return 0
  fi
  if [[ "${REFRESH_OFFLINE:-}" == 1 ]]; then
    echo "REFRESH_OFFLINE=1 and missing/forced cache: $dest" >&2
    echo "  (would download $url)" >&2
    exit 2
  fi
  echo "Downloading $url"
  curl -L --fail --retry 3 -o "$dest.part" "$url"
  mv "$dest.part" "$dest"
}

# The fourth argument is either a BBBike city name or a full URL to any PBF.
# A URL is how a city whose municipality is larger than its BBBike extract gets
# built at all: BBBike publishes Rotterdam as a bbox from lon 4.18, while the
# municipality reaches lon 3.94 at Hoek van Holland, so the boundary relation
# arrives with its western ways missing and assembles into no polygon.
if [[ -n "$source_pbf" ]]; then
  if [[ ! -s "$source_pbf" ]]; then
    echo "Supplied PBF does not exist or is empty: $source_pbf" >&2
    exit 2
  fi
  source_file="$source_pbf"
  wide_source=1
elif [[ "$bbbike_name" == http*://* ]]; then
  # Province-sized downloads are cached and shared: Rotterdam and Den Haag are
  # both in Zuid-Holland, and re-fetching 200 MB per city per run is the kind
  # of cost that stops anyone from running the pipeline.
  source_file="$cache_dir/$(basename "$bbbike_name")"
  download_cached "$bbbike_name" "$source_file"
  wide_source=1
else
  # BBBike city extracts are also cached. Amsterdam and Utrecht used to
  # re-download ~100–140 MB on every refresh even when nothing upstream changed.
  source_file="$cache_dir/${bbbike_name}.osm.pbf"
  download_cached \
    "https://download.bbbike.org/osm/bbbike/${bbbike_name}/${bbbike_name}.osm.pbf" \
    "$source_file"
  wide_source=0
fi

if [[ "$wide_source" == 1 ]]; then
  # Cut the source down to the city, but only after reading the boundary out of
  # it. A bbox guessed before the boundary is read is what slices a relation in
  # half; reading first means the cut is derived from the city's own extent.
  #
  # The cut itself is cached against the source file's mtime so Rotterdam and
  # Den Haag do not re-slice the same province PBF on every Randstad rebuild.
  cut_name="${city_id}-from-$(basename "$source_file" .osm.pbf).osm.pbf"
  cut_cache="$cache_dir/$cut_name"
  cut_stamp="$cut_cache.source-mtime"
  src_mtime="$(source_mtime "$source_file")"
  if [[ -s "$cut_cache" \
      && -f "$cut_stamp" \
      && "$(cat "$cut_stamp")" == "$src_mtime" \
      && "${REFRESH_FORCE_CUT:-}" != 1 \
      && "${REFRESH_FORCE_DOWNLOAD:-}" != 1 ]]; then
    echo "Using cached city cut $cut_cache"
    city_pbf="$cut_cache"
  else
    osmium tags-filter "$source_file" r/boundary=administrative -o "$work_dir/admin.osm.pbf"
    osmium export "$work_dir/admin.osm.pbf" -o "$work_dir/admin.geojson"
    city_bbox="$(node --import tsx scripts/select-municipality-bbox.ts "$work_dir/admin.geojson" "$city_name")"
    echo "Cutting $city_id out of $(basename "$source_file") at $city_bbox"
    city_pbf="$cut_cache"
    rm -f "$cut_cache" "$cut_stamp"
    osmium extract -b "$city_bbox" "$source_file" -o "$city_pbf"
    printf '%s\n' "$src_mtime" > "$cut_stamp"
  fi
else
  city_pbf="$source_file"
fi

osmium tags-filter "$city_pbf" \
  w/waterway=canal,river,stream,drain,dock,ditch r/waterway=canal,river,stream,drain,dock,ditch \
  w/natural=water r/natural=water w/water=canal,river,basin,moat,pond,lake,reflecting_pool,oxbow \
  r/water=canal,river,basin,moat,pond,lake,reflecting_pool,oxbow w/landuse=basin \
  w/highway=motorway,trunk,primary,secondary,tertiary,motorway_link,trunk_link,primary_link,secondary_link,tertiary_link,living_street,residential,unclassified,service,busway,cycleway,pedestrian \
  w/highway=footway/bicycle=yes,designated,permissive,official \
  w/highway=path/bicycle=yes,designated,permissive,official \
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
# Complete building / building:part geometry for the LoD1 ladder — independent
# of colour tags, so Magna Plaza and similar compositions survive the merge.
osmium tags-filter "$city_pbf" wr/building wr/building:part \
  -o "$work_dir/buildings-osm.osm.pbf"
osmium export --add-unique-id=type_id "$work_dir/buildings-osm.osm.pbf" -o "$work_dir/buildings-osm.geojson"
osmium tags-filter "$city_pbf" "r/name=$city_name" -o "$work_dir/boundaries.osm.pbf"
osmium export "$work_dir/boundaries.osm.pbf" -o "$work_dir/boundaries.geojson"
osmium tags-filter "$city_pbf" r/boundary=place -o "$work_dir/place-boundaries.osm.pbf"
osmium export "$work_dir/place-boundaries.osm.pbf" -o "$work_dir/place-boundaries.geojson"

node --import tsx scripts/build-amsterdam-extract.ts "$work_dir/features.geojson" "$work_dir/boundaries.geojson" \
  "$work_dir/place-boundaries.geojson" "$build_dir" "$city_id" "$city_name" "$city_center"
node --import tsx scripts/build-osm-building-appearance.ts "$work_dir/building-appearance.geojson" "$build_dir/buildings-colored.geojson"
node --import tsx scripts/build-basemap-hide-ids.ts "$build_dir/buildings-colored.geojson" "$build_dir/basemap-hide-ids.json"
node --import tsx scripts/build-osm-buildings.ts "$work_dir/buildings-osm.geojson" "$build_dir/buildings-osm.geojson"
node --import tsx scripts/build-osm-trees.ts "$work_dir/features.geojson" "$build_dir/trees.json"
node --import tsx scripts/enrich-amsterdam-wikimedia.ts "--directory=$build_dir"
node --import tsx scripts/enrich-amsterdam-wikipedia-extracts.ts "--directory=$build_dir"
# Card blurbs must be English before publish. street-knowledge is generated from
# the partitions (not hand-curated) so it cannot drift from streets/water.
node --import tsx scripts/build-street-knowledge.ts "$build_dir"
node --import tsx scripts/translate-extracts-to-english.ts "--directory=$build_dir"
node --import tsx scripts/check-extract-english.ts "$build_dir"
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
# Regular files only. `cp "$build_dir"/*` fails on the `staging/` directory the
# bridge builders create, which made a completely successful refresh exit 1
# after it had already copied everything — the worst kind of failure, because
# the data is published and the pipeline says it broke.
find "$build_dir" -maxdepth 1 -type f -exec cp {} "$output_dir"/ \;

# Borough postcards (Centrum, Noord, …) are Amsterdam-only Wikidata enrichment.
# Run after publish so a SPARQL blip cannot block the rest of the extract, and
# so the enricher reads the boundaries that just landed.
if [[ "$city_id" == "amsterdam" ]]; then
  node --import tsx scripts/enrich-amsterdam-neighborhoods.ts || {
    echo "Warning: neighborhood enrichment failed; extract published without refreshed postcards." >&2
  }
fi
