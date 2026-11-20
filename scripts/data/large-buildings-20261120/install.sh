#!/bin/bash
# Large-buildings lane 2026-11-20 (lane/large-buildings-20261120): exact install commands for the integrator.
# Run from the repository root with the lane's crops reachable:
#   export MAP_RECALL_SOURCE_DATA=<map-recall2-source-data checkout holding branch lane/large-buildings-20261120>
# Each --allow-inferred note says why the automated likeness verdict is overruled (blind pass at the pinned poses).
set -euo pipefail

# Zeemanlaboratorium, Plantage Muidergracht 4 (pand 0363100012170498)
node --import tsx scripts/building-recipes/install-large.ts --house=zeemanlab-170498 --install \
  '--allow-inferred=0:blind pass at pinned pose, wall dL from the shaded 2019 street crop, brick set between it and the sunlit canal crops;1:blind pass, wall dL from the shaded 2018 crop, six window axes counted in the crop (the judge reads three through the tree);2:infill bay, crop washed out 32 pct, frame grid and dark panels read from w08-30m6 2016;3:blind pass, canal crop sunlit and overexposed (wall dL), same brick as the street side;4:blind pass, canal crop sunlit and overexposed, two window pairs per panel counted in w02-210 and w03-210;5:glass infill between brick piers, foliage 30 pct on w09-210m6, read from w09-210m6L 2021;6:NW end behind trees, window columns and the striped plinth read from w01-300 2023'
