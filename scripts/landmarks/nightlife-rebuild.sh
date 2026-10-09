#!/bin/bash
# Usage: scripts/landmarks/nightlife-rebuild.sh <id> [azs] [el] [zoom]  (PORT defaults to 4406)
set -e
id=$1; azs=${2:-25,205}; el=${3:-10}; zoom=${4:-1.1}
node --import tsx scripts/landmarks/build-manual-landmarks.ts --only "$id" 2>&1 | grep -E "^$id|Error|error" || true
PORT=${PORT:-4406} node scripts/landmarks/nightlife-shots.mjs "$id" "artifacts/landmark-lanes/$id" "$azs" "$el" "$zoom"
