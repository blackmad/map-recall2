# Lane: compact binary extracts for footprints and trees

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane C.
Evidence: `docs/research/slop-newyork-20261029.md` §1 and §4. Model: opus
for the format and its tests; haiku for the encoder run, the measurements
and the consumer flag.

## The numbers

Slop packs 37,353 footprints (279,930 vertices, heights, decades, holes)
into 441 KB gzip: Morton order, a metadata varint stream, X and Z
zigzag-varint delta streams that run across building boundaries, 0.5 m
grid, gzip -6 with `mtime 0`, strict decode (magic, offsets, count bound,
varint length, leftover bytes all throw). Trees: 70,680 points in 123 KB.
We ship `bag-tiles` 18 MB (296 z14 `geojson.gz`), `building-tiles` 16 MB,
`municipal-trees` 6.2 MB for 311,544 trees plus `trees.json` 1.7 MB for
35,000. At slop's rate 190k pands would be ~2.5 MB and the trees ~600 KB.

## Build

1. `src/canalRecall/extracts/footprintStream.ts`: typed encoder and decoder,
   format `AMB1`: header, a 1 km cell index (byte ranges per cell so a phone
   can fetch one cell with a Range request while desktop takes the city),
   per building: pand id (index into an id table in the header), eaves and
   ridge height at 0.25 m, year, roof kind, polygons. Coordinates in RD
   metres on a **0.1 m** grid (BAG fronts are 4–6 m; 0.5 m would move a
   front by a tenth), Morton order, zigzag varint deltas across buildings.
   Also report the bytes at 0.5 m so the choice is measured.
2. `src/canalRecall/extracts/treeStream.ts`, format `AMT1`: position,
   species index, height class, year.
3. `scripts/extracts/build-footprint-stream.ts` and `build-tree-stream.ts`
   write to `artifacts/extracts/` (staging), print count, bytes raw and
   gzip, bytes per building, and the diff against the current tiles
   (pands missing, heights differing > 0.25 m). Publishing into
   `public/data/extracts/amsterdam/footprints-v1/` is the integrator's step
   after review.
4. Decode in the browser and in the own-ground / three-buildings workers
   with `DecompressionStream`, the gzip magic sniff (the server may already
   inflate), and the strict checks. Consumer behind `?footprints=bin` in
   `buildingTileSource.ts` / the tile streamer; identical features when
   off.
5. Tests: round trip on 10,000 random pands; sentinel pands pinned by id and
   first vertex (Westerkerk, Bloemgracht 80, Nassaukade 506, a pand with a
   courtyard hole, one on the IJburg edge); truncated, bad-magic and
   trailing-byte inputs rejected; the source snapshot's SHA-256 written
   into the header and asserted.

## Measure

Bytes gzip before and after; decode ms on the desktop and on the iPhone
profile at 4× CPU (`perf-profiling-method`); ArrayBuffers at ride start from
`phone-memory.spec.ts`; first-frame-with-buildings from `pop-in.spec.ts`.

## Acceptance

Numbers in the report, the diff table empty or explained, sentinel tests
green. Nothing is called smaller without the before/after row.

## Checks

`npm run lint`; the new `test:extract-streams`; `npm run test:city-startup`;
`PW_PORT=<port> npx playwright test phone-memory pop-in --project=iphone`
under the lock.
