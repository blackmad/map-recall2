# Lane: Hoofdbureau van Politie (Elandsgracht) rework (content, 2026-10-13)

User 2026-10-13, on the batch-3 review sheets of `hoofdbureau-elandsgracht`:
"poor reconstruction here" (the Marnixstraat tower front: the photo is a
brick 1930s–40s block with a tall corner tower under a spire, rich window
surrounds, a balcony on consoles, a big arched ground floor; the model is
a flat tan box with simple arched slots) and "weird use of kit" (the curved
Marnixstraat/Elandsgracht corner: the photo shows a ground-floor arcade of
stone columns under decorated brick with small paired windows; the model
repeats one arch module with the wrong rhythm and flat brick). The z-fight
lane also reports the model fails the new-export gate (85.9 m² plus an
opening overhang) and the batch-3 lane left 14 inventory items open and two
"glass anchor box" hacks inside the brick.

Inputs: `scripts/landmarks/hoofdbureau-elandsgracht-builder.ts` (a large
recipe with `largeCompile` hooks for hand-modelled parts),
`scripts/landmarks/hoofdbureau-elandsgracht-inventory.json`,
`scripts/pand-reference` (rectified panorama crops, CC BY 4.0), the
Beeldbank for the 1940 drawings (architect: Dienst der Publieke Werken, A.
Boeken?), `src/canalRecall/buildingRecipe/largeCompile.ts`,
`blockBuilding/compose.ts`, `docs/buildings-pipeline.md` (large tier),
HISTORY batch 3 entry. Lane owns this builder, its inventory, specs and
re-export (`build-manual-landmarks.ts --only=hoofdbureau-elandsgracht`,
`build:landmark-lods`). Do not edit `game.js`, `index.html`, `package.json`,
bundles, `TODO.md`, `HISTORY.md`. Open data only.

## Deliverables
1. **Measured facades** from rectified panoramas for every street front
   (Elandsgracht, Marnixstraat, the curved corner, the Lijnbaansgracht
   rear): storey lines, bay pitch, window sizes and surrounds, the arcade
   columns and arches, the tower's stages and spire, the balcony, the
   coat of arms, the POLITIE lettering, the sculpture group. Write them as
   elevation JSON the builder reads, not as guessed numbers.
2. **Rebuild**: tower and corner as hand-modelled hooks where the kit
   cannot express them (the arcade as real columns with capitals and a
   proper arch rhythm; the tower with its stepped stages and spire), the
   rest through the large tier; every material tagged `materialSlot` +
   `tint`; ≤ 40k triangles, ≤ 500 KB; no glass anchor hacks.
3. **Gates**: `audit:glb --id=hoofdbureau-elandsgracht` passes geometry
   (holes, see-through, openings, z-fight ≤ 0.5 m²) and slots 100 %;
   inventory with every item modelled / simplified / skipped with a reason;
   camera-matched review sheets for the user's two views (before/after).

## Checks
`npm run lint`, `npm run audit:glb -- --id=hoofdbureau-elandsgracht`,
`node --import tsx scripts/landmarks/check-manual-landmarks.ts`,
`npm run check:landmark-inventory`, `npm run check:osm-under-models`.
Report: branch, SHA, triangles/KB, the audit lines, sheet paths, what was
measured vs inferred, unfinished.
