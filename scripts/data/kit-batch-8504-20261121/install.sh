#!/bin/bash
# Kit batch 1985-2004 (lane/kit-batch-8504-20261121): install commands for the integrator.
# Run from the repository root with
#   export MAP_RECALL_SOURCE_DATA=<map-recall2-source-data checkout holding branch lane/kit-batch-8504-20261121>
# Each --allow-inferred note says why the automated likeness verdict is overruled; the blind verdicts (photo | today | new,
# sides randomised, one fresh opus judge per block, ?world=live at the crops' own poses) are in blind/<id>/key.json and
# verdicts.txt. nieuwpoortstraat-126319 and van-der-palmkade-191-120309 replace their installed recipes in place.
set -euo pipefail
D=scripts/data/kit-batch-8504-20261121
node --import tsx scripts/building-recipes/install-large.ts --house=veemkade-1106-068169 --install "$(bash $D/allow-of.sh veemkade-1106-068169)"
node --import tsx scripts/building-recipes/install-large.ts --house=veemkade-1000-099696 --install "$(bash $D/allow-of.sh veemkade-1000-099696)"
node --import tsx scripts/building-recipes/install-large.ts --house=celebesstraat-125-104501 --install "$(bash $D/allow-of.sh celebesstraat-125-104501)"
node --import tsx scripts/building-recipes/install-large.ts --house=lijnbaansgracht-208-167466 --install "$(bash $D/allow-of.sh lijnbaansgracht-208-167466)"
node --import tsx scripts/building-recipes/install-large.ts --house=bos-en-lommerplein-2-097332 --install "$(bash $D/allow-of.sh bos-en-lommerplein-2-097332)"
node --import tsx scripts/building-recipes/install-large.ts --house=van-der-palmkade-191-120309 --install "$(bash $D/allow-of.sh van-der-palmkade-191-120309)"
node --import tsx scripts/building-recipes/install-large.ts --house=grote-wittenburgerstraat-210-170653 --install "$(bash $D/allow-of.sh grote-wittenburgerstraat-210-170653)"
node --import tsx scripts/building-recipes/install-large.ts --house=windroosplein-2-169221 --install "$(bash $D/allow-of.sh windroosplein-2-169221)"
node --import tsx scripts/building-recipes/install-large.ts --house=windrooskade-2-180754 --install "$(bash $D/allow-of.sh windrooskade-2-180754)"
node --import tsx scripts/building-recipes/install-large.ts --house=flevoparkweg-2-136169 --install "$(bash $D/allow-of.sh flevoparkweg-2-136169)"
node --import tsx scripts/building-recipes/install-large.ts --house=nieuwpoortstraat-126319 --install "$(bash $D/allow-of.sh nieuwpoortstraat-126319)"
node --import tsx scripts/building-recipes/install-large.ts --house=laanweg-92-128179 --install "$(bash $D/allow-of.sh laanweg-92-128179)"
node --import tsx scripts/building-recipes/install-large.ts --house=lucien-gaudinstraat-144-094223 --install "$(bash $D/allow-of.sh lucien-gaudinstraat-144-094223)"
node --import tsx scripts/building-recipes/install-large.ts --house=jesse-owenshof-1-131508 --install "$(bash $D/allow-of.sh jesse-owenshof-1-131508)"

# Held (not installed): tweede-hugo-de-grootstraat-43-148379, panamalaan-10-141142 (hand); reasons in held-installs.json.
# Then (integrator): covers, signature bundle, LODs, goldens, gates
#   npx tsx scripts/build-covers.ts && cp artifacts/bag-tiles/covers.json public/canal-drive/models/covers.json && npm run -s check:covers
#   npm run -s build:canal-signature-landmarks && npm run -s check:signature-bundle
#   npm run -s build:landmark-lods && npm run -s check:landmark-lods
#   npm run -s check:stale-installs && npm run -s check:osm-under-models && npm run -s check:canal
# Goldens are recorded on the branch (fit-golden and large-mesh-golden, --allow=the 15 lane ids).
