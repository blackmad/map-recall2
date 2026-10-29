# Lane: shader facades for the ordinary ring

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane B.
Evidence: `docs/research/slop-newyork-20261029.md` §1. Model: opus for the
shader and the attribute schema; haiku for the strip runs.

## What slop does that we do not

Every building is one quad per footprint edge and a roof, merged per 1 km
cell per material (288 meshes for 37,353 buildings). No UVs. Two vertex
attributes carry the layout: `box` = (wall width, height, exposed height
above the neighbour, seed) and `facadeWall` = (u along the wall, metres
below the top, wall kind: shop / front / rear / lotLine). The shader fits a
whole number of bays to each wall (`bays = round(width / windowWidth)`),
draws storeys from world height, a solid parapet for a partial storey,
coping, sills, lintels, sash bars, bricks that fade below a pixel, and
party walls blank with the exposed strip above a lower neighbour. Every
periodic term is box-filtered over `fwidth` (`filteredPulse`,
`js/tsl-materials.js:148-155`) so there is no moiré at any distance. Styles
are uniforms, so all of it is one program.

We draw ordinary buildings as facade chunks with `DataArrayTexture` bay
textures and geometry extras (`EXTRA_BUDGET` 230 triangles a building,
`facadeExtras.ts`), split 3×3 on touch since #100; the iPad main pass is
1.13–1.36 M triangles.

## Scope

Only the **ordinary ring**: generic BAG pands drawn by
`threeBuildingsBrowser.ts` facade chunks that are not a kit, a recipe, a
block face or a landmark. Kits, recipes, block faces and the 355 landmark
GLBs are untouched. Roofs stay ours (`streetRidge.ts`, roof planner,
3DBAG planes): the shader walls stop at the measured eaves and the roof
mesh sits on them as today.

Flag `?shaderFacades=1`; byte-identical frame when off.

## Attribute schema (Amsterdam needs more than a decade)

Per wall vertex, all in one interleaved buffer, no per-style defines:

- `box` (f32×4): wall width, wall height, exposed height, seed.
- `facadeWall` (f32×3): u along the wall, metres below the eaves, kind
  (shop / front / rear / lotLine). Party walls by slop's three-probe test
  (`js/building-footprints.js:5-21`); our `buildingContextIndex.ts` already
  knows the neighbours.
- `tone` (u8×4): measured wall colour from the wall-colour extract or the
  era palette (`look/palette.ts`), and the window kind index.
- `rhythm` (u8×4): bay width in 0.1 m, storey height in 0.1 m, ground-floor
  kind (shop where our shopfront data says so), accent flags (white frames,
  speklagen, arch rings, keystones, sills: the user's priority list in
  `canal-house-windows-and-accents-20261014.md`).

Window kinds as uniform-indexed parameter sets, four to start: canal sash
(tall, 6 over 6 light bars), 19th-century paired, interbellum horizontal
band, post-war strip. Material stays `MeshLambertMaterial` through
`onBeforeCompile` under the shared rig (`one-material-20261016.md`: Lambert,
`wallGain` 1.106, shadow fill 0.5); `customProgramCacheKey` identical across
kinds so three shares the program; the chunk fade clone keeps sharing it.

## Measure (before → after, same frame)

- Triangles per ordinary building, main-pass triangles on the iPad profile
  at pitch 60 at the Westerkerk and Bilderdijkstraat spots.
- Draw calls and programs on the desktop fixed ride (must stay ≤ 851 and
  ≤ 32).
- `node scripts/ride-perf-fixed-route.mjs` desktop and touch.
- Strips: six generic rows (Bloemgracht, Kinkerstraat generic side, De Pijp,
  Rivierenbuurt, Indische Buurt, Nieuw-West) at 60 m, 150 m and 400 m,
  today | shader | panorama, through the gallery-size review the user asked
  for. Colour parity by `lookParity.ts` within 2 luma of the chunk path.

## Acceptance

The user looks at the six strips. Not accepted if a wall's measured colour
or window kind is lost, or if the far ring reads flatter than today.
Report what the shader cannot yet say (loggias, bay windows, dormers,
gable crowns stay geometry).

## Checks

`npm run lint`; `npm run test:building-lod`; `npm run test:city-startup`;
`PW_PORT=<port> npx playwright test building-look look-parity facade-trees-perf
--project=desktop` under the lock; the iphone project of `facade-trees-perf`.
