# Building recipes

Per-building intents (`houses/<id>/intent.json`) compiled to GLB with gates.
The full pipeline, schemas and measurements are in `docs/buildings-pipeline.md`.
Two kinds:

- `canal-house` (default): one front per house, a library elevation on the
  3DBAG roof, 3k triangle budget: `facts.ts`, `compile.ts`, `install.ts`.
- `large`: keeps the 3DBAG LoD2.2 walls and roofs and cuts a facade system and
  components into each wall group, 12k budget: `facts.ts --large`, `walls.ts`,
  `large.ts`. Not installed by `install.ts`.

## Authoring a large building

1. **Facts.** `node --import tsx scripts/building-recipes/facts.ts --house=<id> --pand=<pand> --large`
   caches the 3DBAG item (`3dbag.json`) and writes `facts.json` with the LoD2.2
   wall surfaces and the neighbours within 90 m. Open data only: 3DBAG, BAG and
   the Amsterdam panorama API (CC BY 4.0, via `npm run pand-reference`).
2. **Walls.** `node --import tsx scripts/building-recipes/walls.ts --house=<id> --detail`
   prints one row per panel (coplanar wall surfaces): bearing, width, eaves,
   top, ground, party height and the surface indices, and writes
   `artifacts/building-recipes/<id>/walls-plan.png` with the panel numbers on
   the footprint. `--detail` shows where each surface sits along the panel, which
   you need when one 3DBAG plane holds parts that look different (split them
   into separate groups; they become separate panels).
3. **Photos.** One street-level reference per wall group you describe, from
   the panorama API (cite `capturedAt`, the thumbnail `url`, licence). Do not
   guess a wall you have no photo of: leave it to `otherWalls` and say so in
   `notes`.
4. **Intent.** Group surfaces into `walls[]` in the order of `sources[]`. Per
   group: `system`, `storeys` (count floors in the photo; or `alignWith` an
   earlier group), `baysPerStorey` (count window axes on the widest panel),
   `ground`, `windows`, `blankStoreys`, and components (`entrance`, `signage`,
   `garageDoors`, `cornice`, `stringCourses`, `police`) only where the photo shows
   them. Colours are named palette entries or hex. Never put coordinates or
   metres in an intent; the validator rejects them.
5. **Compile.** `node --import tsx scripts/building-recipes/large.ts --house=<id>`
   writes `model.glb`, `fitted-recipe.json`, `report.json` and contact sheets
   (`contact-walls-<group>.png`: photo | front-on | 3/4; `contact-aerial.png`).
   Every gate must pass; then `npm run audit:glb -- --file=artifacts/building-recipes/<id>/model.glb`.
   Look at the sheets against the photo before calling it done.
6. **Golden.** `npm run test:fit-golden` lists the new house as changed;
   record it with `-- --write` only after reviewing that canal-house hashes did
   not move.

Common fixes: a fit warning `upper storeys N m` means the storey count is wrong
for the eaves (or the group should `alignWith` another); `eaves-vs-3dbag` failing
on one group usually means a tall part (tower, gable) is in the wrong group;
openings reported as `flush` straddle a face edge (use fewer, wider bays).

## Police stations

The 23 BAG-matched stations are staged in `tmp/public` (not published). Use
`police: {stripe, lamp}`, `entrance.canopy` and `garageDoors` only when the
panorama shows them. The Van Leijenberghlaan station (1976) shows none of them,
so its intent leaves them out; the kit is covered by `largeTier.test.ts`.

## Housing-block kit (lane large-kit-gaps-20261121)

The kit gaps the kit-vs-hand test found on Valkenburgerstraat 69-165 are closed in the large tier, each opt-in and
byte-identical when absent (`largeKitGaps.test.ts`):

- **Per-house components** in a row split: `houses[]` take `windows`, `sills`, `blankStoreys`, `ribbonStoreys`,
  `bayWindows`, `brickStoreys`, `ground`, `residential` and `wallMaterial`, bays and storeys counted within the house
  (`houseComponents.ts`; validated by the group rules of the same name).
- **Render panels** (`renderPanels`) and **accent panels** (`accentPanels`): a panel in its own colour and finish over a
  span of bays and storeys of the main panel, round the cut windows (`blockBuilding/facePanels.ts`). Openings that could
  not be cut (laid flush) are covered, so keep ribbons off a panel's outer edge under a panel.
- **Loggia look**: `lining` (returns and back wall in their own colour) on `loggias`, `houses[].loggias` and
  `loggiaBands`; `back: "door-window"` on cell loggias (`blockBuilding/loggia.ts`, shared with other lanes).
- **Residential ground**: `ground: "residential"` with an optional `residential: {pattern, doors}` of entrance doors,
  storage doors, windows and wall per bay, no fascia (`blockBuilding/residentialGround.ts`). The factory draft gives
  housing pands this ground when the queue item says `use: "housing"`.
