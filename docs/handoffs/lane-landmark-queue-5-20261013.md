# Lane: the landmark queue, next five bespoke builders (content, 2026-10-13)

`public/canal-drive/landmark-backlog.json` has 124 `pending` destinations
(`landmark-queue.html` shows them; `scripts/landmarks/build-poi-backlog.ts`
rebuilds the file). Bespoke builders continue with no cap (user 2026-10-13):
`scripts/landmarks/<id>-builder.ts`, exported by
`node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>`
then `npm run build:landmark-lods`. Rules that are new since most builders
were written: every material carries `materialSlot` + `tint`
(`glbQuality.ts` gates it); the geometry audit gates holes, see-through,
far-outside, opening overhang/floating/buried and z-fight (0.5 m² coplanar +
tight; frames ≥ 3 cm proud or set in a reveal); a signature inventory JSON
from the photos is required before export (`landmark-inventory-gate.ts`;
user: inventory reliefs, sculpture, signs and model them: the Hoofdbureau's
coat of arms was missed once). Photo sources: `scripts/pand-reference`
(panoramas CC BY 4.0), Wikimedia Commons per-file licence, the Beeldbank.
Model from measurements and photos, never from downloaded meshes.

Lane owns the five builders, their inventory/footprint/poi JSON, your
branch's catalogue entries. Do not edit `game.js`, `index.html`,
`package.json`, bundles, `TODO.md`, `HISTORY.md`. Open data only.

## Deliverables
1. Pick the five most notable pending destinations (museums, churches,
   theatres, named buildings a visitor would recognise; prefer the centre
   and the ride routes) and say why each.
2. Per landmark: inventory JSON, builder, GLB ≤ 500 KB and ≤ 40k
   triangles, `audit:glb` pass (geometry and slots 100 %), gallery-size
   contact sheet (four sides + the panorama), the lod1.
3. Catalogue entry with footprint, attribution, `suppressOsmIds` checked by
   `check:osm-under-models`.

## Checks
`npm run lint`, `npm run audit:glb -- --id=<ids>`, `node --import tsx
scripts/landmarks/check-manual-landmarks.ts`, `npm run check:landmark-inventory`,
`npm run check:osm-under-models`, `npm run check:covers`.
Report: branch, SHA, per-landmark table (tris, KB, audit), sheet paths,
unfinished.
