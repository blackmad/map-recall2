# Lane: Tropenmuseum survey and build (content, 2026-10-14)

The queue-6 lane found the Tropenmuseum (Linnaeusstraat 2, 1926, J.J. van
Nieukerken) unbuildable from the facts: BAG pand 0363100012082861 is a
4-vertex rhombus, the rest of the museum is ~25 OSM stand-in ways with rough
heights and the 3DBAG facts are unusable. Build the footprint first, then the
model. Inputs: BGT `pand` and BAG `verblijfsobject` outlines (PDOK WFS), 3DBAG
LoD2.2 for the parts that exist, the panoramas (CC BY 4.0, Linnaeusstraat,
Mauritskade, the Oosterpark side), Wikimedia Commons (licence recorded),
Beeldbank drawings; `docs/buildings-pipeline.md` (bespoke builders, footprint
surveys, `suppressOsmIds`, inventory gate), `scripts/landmarks/noorderkerk-builder.ts`
and the Hoofdbureau's measured-facade pattern (`-facades.json`, `elevation-grid.ts`).

## Deliverables
1. A surveyed footprint (`tropenmuseum-footprints.json`) assembled from
   BGT/BAG outlines for the whole block (museum, the Koninklijk Instituut
   voor de Tropen wing, the theatre), with heights per part from 3DBAG where
   present and from the panoramas elsewhere; the OSM stand-in ways and the
   pands listed for suppression; `check:osm-under-models` and `check:covers`
   clean after the integrator rebuilds covers.
2. The bespoke model: the main front with its two towers and the central
   gable, the Mauritskade front, the roofs (slate, dormers), the sculpture
   programme inventoried from photos (reliefs over the entrance, the
   corner figures) and modelled or simplified with reasons; `materialSlot` on
   every material; ≤ 40k tris, ≤ 500 KB; `audit:glb` hard gates; lod1.
3. Camera-matched sheets for the Linnaeusstraat front and the Mauritskade
   corner; four-side and street strips.

## Checks
`npm run lint`, `npm run audit:glb -- --id=tropenmuseum`,
`npm run check:manual-landmarks`, `npm run check:landmark-inventory`,
`npm run check:osm-under-models`. Report: branch, SHA, footprint sources,
tris/KB, audit lines, sheets, unfinished.
