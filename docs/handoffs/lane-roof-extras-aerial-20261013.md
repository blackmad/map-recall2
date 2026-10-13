# Lane: real roof colours and roof furniture from the open aerial photos (content/domain, 2026-10-13)

User 2026-10-13, two aerial screenshots of the Kinkerbuurt / Ten Katestraat
(Oud-West) at ~200 m: "I wonder if we need some varied roof geometry
generators/textures/extras, like many of these roofs have decks, HVAC equip,
etc, could look at aerial imagery" and "so much grey". What the shots show:
every flat roof is the same mid-grey slab, every pitched roof one of two
tints, nothing on any roof; the real Kinkerbuurt roofs are a mix of grey
gravel, black and pale bitumen, white EPDM, red pantile, green sedum, solar
arrays, roof terraces with railings and furniture, skylights, chimneys,
vent stacks, plant boxes and lift overruns.

**Source**: PDOK "Luchtfoto Actueel Ortho 8cm RGB" (Beeldmateriaal
Nederland, CC BY 4.0; WMTS/WMS at `service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0`,
also the 25 cm variant) and the 8 cm CIR set for vegetation; open data,
allowed by the project rule (no Google/Apple). Archive what you pull under
`~/Code/map-recall2-source-data/datasets/luchtfoto-20261013/` with the
licence line. Inputs in the repo: 3DBAG roof parts per pand
(`public/data/extracts/amsterdam/bag-tiles/`, `bag-facts/` with roof type,
eaves, ridge), `src/canalRecall/roofMesh.ts`, `threeBuildingMesh.ts`, the
roof cells in `look/slotCells.ts` / `bayTextures.ts`, `look/palette.ts`
(LOOK.md bands), `buildingTypes/generate.ts` (instanced units, the model for
cheap repeated furniture), `inventory-trees-source.js` (how instanced things
are placed from a sidecar), `docs/buildings-pipeline.md`. Lane owns a new
`scripts/roofs/` pipeline, a `roof-facts` sidecar per tile, the roof slot
choice in the generic/mid tier, and a `roofFurniture` instanced layer; ≤ 20
reported lines in `vector-map.js`. Do not edit `game.js`, `index.html`,
`package.json`, bundles, catalogues, `TODO.md`, `HISTORY.md`. Coordinate by
report, not by file, with the roofs-and-sheds lane (roof attachment, cell
scale by distance, sheds) and the sun-and-mood lane (palette): you choose
*which* slot a roof gets, they own how a slot looks.

## Deliverables
1. **Roof colour per pand from the orthophoto**: for every 3DBAG roof part,
   sample the 25 cm ortho inside the part's polygon (eroded 0.5 m), reject
   shadowed pixels, and classify into the slot table: `gravel`, `bitumen-dark`,
   `bitumen-light`, `white-membrane`, `pantile-red`, `pantile-dark`, `slate`,
   `zinc`, `sedum`, `solar` (+ share), `terrace` (decking/tiles + furniture),
   `glass`. Store `{slot, rgb, confidence, solarShare, terrace}` in a
   `roof-facts` sidecar keyed by pand (same tiling as `bag-facts`); the
   generic and mid tiers read it for the roof slot and tint (LOOK.md bands,
   `palette.ts` names). Report the slot histogram city-wide and for the
   Kinkerbuurt, and a contact sheet of 40 roofs (ortho crop beside the
   render) for accuracy; target ≥ 85 % agreement on a hand-labelled 100.
2. **Roof furniture, instanced and cheap**: from the same crops detect and
   place (position + size within the roof polygon) chimneys and vent
   stacks (small dark cylinders/boxes), skylights and roof hatches, HVAC
   units and lift overruns (grey boxes > 1.5 m), terrace railings along
   the parapet where `terrace`, solar arrays as a flat dark tiled quad with
   the measured share. One unit mesh per kind (≤ 60 tris), placed through an
   `InstancedMesh` per tile in the shared frame, LOD: present within ~250 m,
   dropped beyond; budget ≤ 0.3 ms/frame desktop on the fixed route and
   ≤ 2 MB total sidecar for the city. Detection may be simple (colour +
   shape heuristics on the 8 cm crop, or a small classifier you train on
   your own labels); say what it is and its precision on the 100 labelled.
3. **Pitched-roof variety**: where facts say pitched, use the ortho colour
   to pick pantile red vs dark vs slate instead of the current two tints;
   dormers from 3DBAG roof parts where present (report how many pands have
   them).
4. **Before/after** at the user's Kinkerbuurt viewpoint (~200 m, looking
   north-east over Ten Katestraat), the Dam, Nieuw-West, a canal-belt block
   at 100 m, desktop and phone; perf delta on the fixed route; LOOK.md roof
   band check (no slot outside its luma band).

## Checks
`npm run lint`, `npm run test:bag-tiles`, `npm run test:building-types`,
`npm run test:look`, the look e2e. Report: branch, SHA, the histogram, the
accuracy numbers, shot paths, perf, the `vector-map.js` lines, licence line
for the archive, unfinished.
