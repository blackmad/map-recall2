# Lane #103: batch block-face installer (2026-10-29)

Branch `lane/blockface-batch-20261029`. Tool: `scripts/block-face/batch.ts` (header documents every step and flag).
Typed decisions: `src/canalRecall/blockFace/batchInstall.ts` (corner trim, fallback dates, install verdict, facings,
year prefilter, drawn-luma brick) and `stripQuality.ts`, both tested (`npm run test:block-face`).

## Yield

| Batch (report in `scripts/block-face/batch/`) | Faces | Pands tried | Installed runs / pands | Main failure |
|---|---|---|---|---|
| oud-west-kinkerstraat (authored intents) | 15 | 139 | 1 / 2 (kinker-112-116) | GLB audit 11, likeness 7 |
| oud-west-helmersbuurt-oost (helmersbuurt library) | 50 | 358 | 0 (4 faces installed earlier) | no-type 46 |
| de-pijp-sarphatiparkbuurt (de-pijp library) | 62 | 682 | 7 / 19 | no-type 48 |
| de-pijp-frans-halsbuurt (de-pijp library) | 37 | 323 | 4 / 11 | no-type 31 |
| Jordaan | not run | | | no Jordaan type library exists: every face would be no-type |

Bilderdijkstraat: every bilder-* face is already installed. Kinkerstraat 49-63 and 86-110 were left to the
oudwest-kit lane (uncommitted work there).

## Kinkerstraat failure tabulation (14 failed)

glb-audit 11 (opening-outside 5, coplanar/geometry-regression 8, detached 2, blank-wall 1), likeness under NCC 0.15 7,
storey-height gate 2, no photo evidence 2, strip re-take failed 1 (244-332: discovery ends differ from the authored
members). Fixed generically during the lane: stripOverDrawn low (10 faces at 0.64-0.77, now 0.87-1.14 by the refit) and
the door/brick facing z-fight (front `overrides.palette` -> house `paletteOverrides`, 4 faces). Faces failing on the
audit alone: 142-178, 31-49, 315-359, 363-371.

## Kit gaps (for later lanes)

1. **opening-outside** (Kinkerstraat 31-49, 120-138, 315-359, 334-374, 386-390): three causes, (a) shopfront glass at
   z 0.1-0.2 m reaching past the wall silhouette in u (front split off the row plane), (b) dormer glass/frames piercing
   the roof plane (315-359: 20 parts, 17 m2), (c) 2 cm door-material slivers 0.6 m deep at storey lines (142-178,
   363-371; each <= 0.02 m2 but the geometry-regression sums them to 0.05 > 0.02 for a new export).
2. **Type libraries by build year**: no-type is 125 of 133 faces in the three buurt runs. Year outside every type: 39
   faces; every type vetoed on year/frontage after the strip: 69; score under 0.7: 17. De Pijp needs post-1893 and
   1900s-1920s types (Albert Cuypstraat, Govert Flinckstraat, Frans Halsstraat); Helmersbuurt-Oost needs Overtoom,
   Eerste Constantijn Huygensstraat, Nassaukade, Bosboom Toussaintstraat types. Oud-West `types/oud-west` has no
   `match` blocks, so only authored intents can use it. Jordaan has no library at all.
3. **Pale buff / yellow brick** (Albert Cuypstraat 153-179, 241-259, stripOverDrawn ~1.95 even after matching): the
   city brick tint clamps lightness, so these fronts draw too dark. Needs a light-brick tint range, not a per-face fix.
4. **Likeness** on the 2026-10-14 authored Kinkerstraat intents (109-161, 173-225, 334-374: 4-8 pands each under
   0.15): types are wrong for the photo; re-author by type, not by face.
5. Seen on the spot-review sheets: Eerste Jan Steenstraat 84-140 dormers drawn large and white where the photo has
   small pointed ornamented dormers, arched entries drawn as plain doors; Kinkerstraat 112-114 brick gable ornament
   not expressed.

## Integrator steps

- `npx tsx scripts/look/build-chunk-wall-exposure.ts --write` (12 new chunks; test:look fails without it).
- Covers: `npx tsx scripts/build-covers.ts`, copy `artifacts/bag-tiles/covers.json` to
  `public/canal-drive/models/covers.json`, `npm run check:covers`.
- chunk-wall-exposure, bake-frontages, buurt pages as for any chunk install.
- Strip archiving: strips live untracked in this worktree's `staging/block-face/<face>/strip.jpg` (re-taken or copied
  from integrator-plan / integrator / oudwest-kit staging); archive them before the worktree is pruned.
- Spot-review sheets: `staging/block-face/batch/<batch>/contact.jpg`.

## Running it

    node --import tsx scripts/block-face/batch.ts --name=<batch> --buurt=<slug> --district=<library> --ride --install \
      --strip-cache=../integrator-plan,../integrator
    BLOCK_FACE_OVERPASS_AREA=<file>   one buurt-wide Overpass response (overpass-api.de was at capacity; kumi worked)

Resumable: faces already in the report are skipped; `--redo` reruns all and keeps installs. A face is installed only
when strip quality, compile gates, GLB audit, per-pand edge NCC >= 0.15 (half the pands scored) and stripOverDrawn
0.8-1.25 all pass; failed faces are left as they were (wall fits and facing moves reverted).
