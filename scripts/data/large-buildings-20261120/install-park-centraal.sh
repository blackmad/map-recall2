#!/bin/bash
# Park Centraal (stadhouderskade-25-233471) restage, lane large-buildings-20261120 round 2. Run from the repo root with
# MAP_RECALL_SOURCE_DATA pointing at a map-recall2-source-data checkout that has pand-reference-walls/0363100012233471.
set -e
node --import tsx scripts/building-recipes/install-large.ts --house=stadhouderskade-25-233471 --install \
  '--allow-inferred=0:hotel front is a dark concrete frame grid, not brick, with glass balcony rails on storeys 2-6 read from w02-1L 2024-12-11, the glazing band reads the pale rail panels;1:MOMO range from w04-1 2022-04-26, red-brick ground, arched storey with bars, one dressed storey, mansard with dormers, dark paint read by hand;2:SW range from w01-246 2023-01-10, stone ground, balconies on storeys 1-3 every second bay, the photo column count reads the single windows between the balcony pairs;3:SW return of the MOMO range from w06-246 2024-12-11, same arched storey, dressings and mansard as walls[1]'
# then the integrator steps in install.sh (covers, signature bundle, LODs, goldens with --allow=stadhouderskade-25-233471)
