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

# da-costakade-146-236799 (blank-walls hold, round 3; rear ranges inferred): remove the id from held-installs.json, then
node --import tsx scripts/building-recipes/install-large.ts --house=da-costakade-146-236799 --install \
  '--allow-inferred=0:unchanged from the shipped recipe (w01-248L 2019-12-09), not refit in this lane;3:unchanged from the shipped recipe (w01-248L 2019-12-09), not refit in this lane'

# funenpark-427-184743 (backlog row 1, blank-side; round 3)
node --import tsx scripts/building-recipes/install-large.ts --house=funenpark-427-184743 --install \
  '--allow-inferred=0:shipped south front unchanged, crop 37 % foliage;1:shipped south front unchanged, crop 38 % foliage;2:shipped south front unchanged, crop 31 % foliage;3:shipped east arc unchanged, crop foliage;4:shipped east arc unchanged, crop washed out;5:shipped west front unchanged (w03-291);6:shipped west front unchanged, crop 26 % foliage;7:shipped west front unchanged, crop 26 % foliage;8:low west ranges from w09-286 and w14-281 2020-09-07, staggered double and single windows swapped by storey, read by hand;9:tall west range over the glazed ground from w05-272 right 2020-09-07, the auto judge compares a different part of the crop;10:punched block from w05-272 left 2020-09-07, small single windows read by hand;11:east railway glass screen from w11-92L, w10-94 and w15-92, camera too close for the judge'

# stadhouderskade-12-090765 (backlog row 6, new large recipe; round 3)
node --import tsx scripts/building-recipes/install-large.ts --house=stadhouderskade-12-090765 --install \
  '--allow-inferred=0:NW crop w03-337L 2021-03-24 is overcast and shaded (#322f2e), brick sampled from the sunlit SE crop w01-157, paired windows counted as one column each'
node --import tsx scripts/building-recipes/install-large.ts --house=kattenburgerstraat-164930 --install --allow-inferred="0:NW front w02-315 2025-01-30 unchanged from the installed recipe;1:SE front w05-135 2019-05-21 unchanged from the installed recipe;2:inferred lower maisonette band from the long fronts ribbon glazing;3:inferred upper maisonette band from the long fronts ribbon glazing;4:inferred deck-to-roof fronts from the long fronts;5:mosaic podium end walls sampled from w09-45 2019-05-21;6:inferred podium fronts in the base brick;7:De Poort w12-135 2020-04-22 portal drawn blank;8:inferred NW range on the deck"
node --import tsx scripts/building-recipes/install-large.ts --house=weesperstraat-107-165490 --install --allow-inferred="0:W front w01-251L 2019-01-14 panel brown from w02-70;1:E front w02-70 2022-04-25 sampled;2:E glazed pavilion w02-70 2022-04-25;3:N front w04-344 2017-07-06;4:brick wing w06-164L washed out brick inferred"
node --import tsx scripts/building-recipes/install-large.ts --house=spinozastraat-51-243487 --install --allow-inferred="0:S front unchanged from the installed recipe;1:N front unchanged from the installed recipe;2:corner house unchanged from the installed recipe;3:SE yellow grid w03-122 2019-05-14;4:E yellow grid w06-72 2021-03-19;5:warehouse w07-341L 2021-03-19 brick sampled;6:corner house N w09-341 2024-12-10"
node --import tsx scripts/building-recipes/install-large.ts --house=weesperstraat-100-181841 --install --allow-inferred="0:E range w02-73L 2024-12-03 colours inferred;1:E grid w02-73L 2024-12-03 colours inferred;2:E tower w04-73 2025-01-09 colours inferred;3:N front w05-343 2017-07-06 colours inferred;4:N low front w05-343 colours inferred;5:NE dark brick end w03-67 2024-12-03 colours inferred"
node --import tsx scripts/building-recipes/install-large.ts --house=keizersgracht-359-253947 --install --allow-inferred="0:W canal front w01-274 2017-07-07 brick sampled on w06-184L;1:S front w06-184L 2023 brick sampled"
node --import tsx scripts/building-recipes/install-large.ts --house=pand-165427 --install --allow-inferred="0:measured or prior recipe group kept as installed;1:measured or prior recipe group kept as installed;2:measured or prior recipe group kept as installed;3:measured or prior recipe group kept as installed;4:measured or prior recipe group kept as installed;5:measured or prior recipe group kept as installed;6:measured or prior recipe group kept as installed;7:measured or prior recipe group kept as installed;8:canal front sections w08-47L 2021-01-22 group 0 palette;9:SW wing w04-227 2021-09-09 brick sampled;10:dark SW wing w09-229L 2020-01-08 brick sampled;11:dark SW wing w10-228L 2020-01-08 brick sampled"
