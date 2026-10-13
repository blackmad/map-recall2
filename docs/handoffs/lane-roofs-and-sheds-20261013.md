# Lane: roof attachment, roof texture scale, and garden sheds (content/domain, 2026-10-13)

User 2026-10-13, two screenshots. (1) A corner building on a shopping
street ("Bonboon"): a pitched red-tile roof with dormers sits on top of a
flat-roofed brick block with a white parapet, the pitched roof not attached
to the walls below ("this roof is not attached properly"), and the tile
texture reads as noise at chase distance ("this roof texture is too busy").
(2) Willem de Zwijgerlaan, Chassébuurt: behind every terrace house stands
a box in the back garden, drawn at near-house height in brick with flat
roofs — "does every one of these houses have an auxiliary building?"

Inputs: `src/canalRecall/roofMesh.ts`, `threeBuildingMesh.ts`, the worker
roof classifier (`study-roofs` bundle, `build-lod1-city.ts`), the roof cells
in `look/slotCells.ts` / `bayTextures.ts`, `public/data/extracts/amsterdam/bag-tiles/`
(+ `bag-facts/`: eaves, ridge, roof, year per pand; sheds are BAG pands too),
`docs/buildings-pipeline.md` "Known gaps", `check:osm-under-models`. Lane
owns the roof mesh/classifier, roof cells, the generic-building pass that
decides what a pand looks like; ≤ 20 reported lines in `vector-map.js`.
Do not edit `game.js`, `index.html`, `package.json`, bundles, catalogues,
`TODO.md`, `HISTORY.md`.

## Deliverables
1. **Roof attachment**: find the pand in shot (1) (Bilderdijkstraat / De
   Clercqstraat area, corner with a shop; use the demo-shots standpoint
   tooling), then the class of defect: a generic/mid-tier pand whose 3DBAG
   roof (pitched, from facts) is placed on an extrusion whose eaves height
   comes from OSM (flat) — or a chunk/recipe neighbour. Fix in the roof
   mesh (eaves must meet the wall top; where a pand is split
   flat+pitched, follow the 3DBAG roof parts), add a geometry check in the
   tile/roof audit for "roof floats above or below the wall top by > 0.3 m"
   and report how many pands it flags city-wide.
2. **Roof texture scale**: the tile cell repeats too fine; set the
   pantile/slate cell scale by distance tier (near 1×, mid 0.5×, far flat
   colour) and reduce the cell's contrast to LOOK.md's roof band; shots at
   chase and saddle distance before/after on the same block.
3. **Garden sheds**: with `bag-facts`, classify pands as `shed` when
   footprint < 25 m² (or < 40 m² and eaves < 3.2 m) and not street-facing
   (no OSM way within 6 m of any footprint edge); render them at their
   true 3DBAG height (most are 2.4–3 m, the shot shows them far taller — find
   why: missing height falls back to a storey default?), in a muted shed
   colour, flat roof, no windows; drop them below the near tier. Report the
   count per district and the share of houses on Willem de Zwijgerlaan
   with a BAG shed (to answer the user: it is probably true that most do).
4. **Allotment complexes** (user screenshot 2026-10-13: the Westerpark /
   Sloterdijkermeer volkstuinen seen from the Chassébuurt — hundreds of
   garden huts drawn as small houses with pitched roofs on a dark paved
   ground): classify huts in OSM `landuse=allotments` / BGT `tuin` areas
   as `shed` too, draw them as low flat-roofed boxes in a muted colour at
   their 3DBAG height, and hand the ground colour (gardens, not pavement)
   to the ground lane with the polygon source you used.
5. Before/after at the two user spots plus Bilderdijkstraat and a
   Nieuw-West street; desktop and phone width.

## Checks
`npm run lint`, `npm run test:bag-tiles`, `npm run test:building-types`,
`npm run check:osm-under-models`, the look e2e if roof cells change.
Report: branch, SHA, the attachment cause and city-wide count, the shed
numbers, shots, the `vector-map.js` lines, unfinished.
