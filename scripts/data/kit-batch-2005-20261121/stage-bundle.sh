#!/bin/bash
# Build signature-placement.bundle.js against the staged catalogue into artifacts/kit-batch-2005/bundles (BUNDLES_DIR);
# the committed catalogue is restored right after (the bundle imports catalogue.json at build time).
set -euo pipefail
C=public/canal-drive/ordinary-buildings-data/catalogue.json
cp artifacts/kit-batch-2005/staged/ordinary-buildings-data/catalogue.json $C
mkdir -p artifacts/kit-batch-2005/bundles
npx esbuild src/canalRecall/landmarks/browser.ts --bundle --format=iife --global-name=CanalRecallSignatureLandmarks --outfile=artifacts/kit-batch-2005/bundles/signature-placement.bundle.js --minify --log-level=warning || true
/usr/bin/git checkout -- $C
/usr/bin/git diff --quiet -- $C && echo "bundle staged, catalogue restored"
