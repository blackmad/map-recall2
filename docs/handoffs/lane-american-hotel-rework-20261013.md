# Lane: American Hotel rework from the camera-matched sheets (content, 2026-10-13)

User 2026-10-13, two camera-matched BEFORE/AFTER sheets: "poor reconstruction
here" (a tan-brick front with a tall corner tower under a spire, arched
ground-floor openings and rich window surrounds, rendered as a flat box with
simple arched slots) and "weird use of kit" (a curved corner with a
ground-floor arcade of stone columns under decorated brick with small paired
windows, rendered as one repeated arch module with the wrong rhythm). The
Hoofdbureau lane checked all 14 Hoofdbureau walls and found no spire tower
and no curved arcade; the description matches the **American Hotel**
(Leidsekade 97 / Leidseplein, Willem Kromhout 1902, Jugendstil; the corner
clock tower with its spire, the arcaded Leidsekade loggia, the curved
Marnixstraat corner, the Café Américain terrace). Treat the sheets as this
model's unless the before-sheet proves otherwise (compare against
`artifacts/review/american-hotel*/` on main and the gallery card).

Inputs: `scripts/landmarks/american-hotel-builder.ts`, `-elevations.json`,
`-footprints.json`, `-meta.json`, `-poi.json`; the unmerged branch
`fix/american-hotel-windows-20261011` (1 commit; read its diff and fold in
what still applies); rectified panoramas via `scripts/pand-reference`
(CC BY 4.0); Beeldbank for the 1902 drawings; Wikimedia Commons with the
licence recorded; `docs/buildings-pipeline.md` (bespoke builders, z-fight
checklist, inventory gate, `materialSlot`); the Hoofdbureau lane's
elevation JSON pattern (`hoofdbureau-elandsgracht-facades.json`,
`elevation-grid.ts`, `-walls.ts`) as the measuring method. Lane owns the
American Hotel builder, inventory, re-export (`build-manual-landmarks.ts
--only=american-hotel`, `build:landmark-lods`) and sheets. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.
Link `node_modules` into your worktree if it is missing. Open data only.

## Deliverables
1. Measured facades (elevation JSON) for the Leidsekade front, the tower,
   the Leidseplein/Marnixstraat curved corner and the Singelgracht side:
   storey lines, bay pitch, arch spans and springing, window surrounds,
   the tower's stages, clock and spire, the loggia columns, the terrace.
2. Rebuild: the tower with its stages, clock faces and spire; the arcade
   as real columns and arches at the measured rhythm; the curved corner
   following the footprint curve rather than a repeated flat module; the
   decorated brick bands and the paired windows; the cafe terrace awning;
   every material slotted and tinted; ≤ 40k triangles, ≤ 500 KB.
3. Gates: `audit:glb --id=american-hotel` passes (holes, see-through,
   openings, z-fight ≤ 0.5 m², slots 100 %); inventory with every signature
   item modelled / simplified / skipped with a reason; camera-matched
   before/after sheets for the user's two views.

## Checks
`npm run lint`, `npm run audit:glb -- --id=american-hotel`,
`npm run check:landmark-inventory`, `npm run check:osm-under-models`.
Report: branch, SHA, triangles/KB, audit lines, sheet paths, measured vs
inferred, unfinished.
