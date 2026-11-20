#!/bin/bash
# Large-buildings lane 2026-11-20 (lane/large-buildings-20261120): exact install commands for the integrator.
# Run from the repository root with the lane's crops reachable:
#   export MAP_RECALL_SOURCE_DATA=<map-recall2-source-data checkout holding branch lane/large-buildings-20261120>
# Each --allow-inferred note says why the automated likeness verdict is overruled (blind pass at the pinned poses).
set -euo pipefail

# Zeemanlaboratorium, Plantage Muidergracht 4 (pand 0363100012170498)
node --import tsx scripts/building-recipes/install-large.ts --house=zeemanlab-170498 --install \
  '--allow-inferred=0:blind 6 of 6 new preferred (blind1), wall dL from the shaded 2019 street crop, brick set between it and the sunlit canal crops;1:blind1 new preferred, wall dL from the shaded 2018 crop, six window axes counted in the crop (the judge reads three through the tree);2:infill bay, crop washed out 32 pct, frame grid and dark panels read from w08-30m6 2016;3:blind1 new preferred, canal crop sunlit and overexposed (wall dL), same brick as the street side;4:blind1 new preferred, canal crop sunlit and overexposed, two window pairs per panel counted in w02-210 and w03-210;5:glass infill between brick piers, foliage 30 pct on w09-210m6, read from w09-210m6L 2021;6:NW end behind trees, window columns and the striped plinth read from w01-300 2023'

# Weesperflat, Weesperstraat (pand 0363100012169740)
node --import tsx scripts/building-recipes/install-large.ts --house=weesperflat-169740 --install \
  '--allow-inferred=0:blind1 new preferred 3/3 and blind2 open void + lip preferred 3/3, the photo wall cluster lands on the dark window bands and the recessed storey (wall family unresolved), concrete tone hand-sampled from the sunlit 2025-01-09 segment;1:south end below the slab, same concrete and balcony bands as walls[0], read from w01-248s3h40L 2024-12-10'

# Then (integrator): covers, LODs, goldens, gates
#   npx tsx scripts/build-covers.ts && cp artifacts/bag-tiles/covers.json public/canal-drive/models/covers.json && npm run -s check:covers
#   npm run -s build:canal-signature-landmarks && npm run -s check:signature-bundle
#   npm run -s build:landmark-lods && npm run -s check:landmark-lods
#   npm run -s test:fit-golden -- --write && node --import tsx scripts/building-recipes/large-mesh-hashes.ts --write --allow=zeemanlab-170498,weesperflat-169740
#   npm run -s check:stale-installs && npm run -s check:canal

# valckenierstraat-65-170734 (blank-walls hold, round 2): remove the id from scripts/building-recipes/held-installs.json, then
node --import tsx scripts/building-recipes/install-large.ts --house=valckenierstraat-65-170734 --install \
  '--allow-inferred=0:unchanged from the shipped recipe, judged FAIL on 2026-10-29 for tone and window shape, not refit in this lane;1:set-back top floor, no crop reaches it, unchanged from the shipped recipe;2:unchanged from the shipped recipe, judged FAIL on 2026-10-29 for column count, not refit in this lane;3:north steel-window wing unchanged, w04-343L 2021-01-22 confirms the two ribbon storeys;4:E lab faces seen across the canal from the w08-73 pano 2021-01-22, four ribbon storeys in brick, no straight crop;5:N face behind the wing, its top seen over the wing in w04-343L 2021-01-22, ribbon storeys as the S and W fronts'
