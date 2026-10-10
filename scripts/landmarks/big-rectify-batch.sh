#!/bin/bash
# Usage: bash scripts/landmarks/big-rectify-batch.sh <id> <jobsFile> [minYear=2015]
# jobsFile lines: "<wall> <t0> <t1> <heightM>"; writes artifacts/landmark-lanes/<id>/rect<wall>-<t0>.jpg and prints the chosen panorama per job.
id=$1; jobs=$2; minYear=${3:-2015}
out=artifacts/landmark-lanes/$id
mkdir -p "$out"
while read -r w a b h; do
  [ -z "$w" ] && continue
  echo "-- wall $w t $a..$b"
  RADIUS=${RADIUS:-60} node --import tsx scripts/landmarks/big-rectify.ts "$id" "$w" "$a" "$b" "$h" "$out/rect$w-$a.jpg" 20 0 "$minYear" 2>&1 | tail -1 | cut -c1-210
done < "$jobs"
