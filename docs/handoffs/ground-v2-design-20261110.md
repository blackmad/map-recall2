# Ground v2: one clipped partition per cell, baked offline (design, 2026-11-10)

Lane G2-design, issue #370. The plan this answers is `docs/handoffs/ground-v2-plan-20261110.md`, section G2. This is a design for the judgement session to review. It changes no production code. The numbers come from two spikes under `scripts/spikes/` (see "What the spike measured"), run on origin/main 34e809901 against the published extracts.

## In one paragraph

Every 1 km cell becomes one baked file, `ground-v2/<key>.bin`. It holds one vertex buffer and one triangle list, grouped by the existing `GroundLayer` ids, so the materials stay the same. The bake works in integer millimetres. It clips every surface source against the others by a fixed precedence, so each square metre has exactly one owner. Shared edges are noded so neighbours share vertices. Then a constrained Delaunay triangulation drapes the result on the relief, with adaptive Steiner points and breaklines. A height step (kerb, cut wall, abutment, quay) becomes a pair of vertices at the same xy plus a vertical strip, never a lift. Decks, cuts, slots and portals come in through one typed constraint interface, `GroundConstraint`. G3's crossing records and G1's caps both feed it. The runtime decodes the file into the same `BuiltCell.layers` shape that `gameGround.ts install()` already takes. Phase 1 bakes the surface only; the worker keeps building the overlays (paint, tram, track, bollards, quay walls, deck bodies), which removes 50–63 % of today's worker build time. Phase 2 bakes the overlays too, and only if the wire and deploy budgets allow.

## What the spike measured

Script: `scripts/spikes/ground-v2-partition.ts`. It ran in Node on real `cellInput` data. It clipped by precedence with polygon-clipping (and clipper2-js for comparison), noded the shared edges, added adaptive Steiner points from the relief, ran a constrained Delaunay triangulation with `@kninnug/constrainautor` and `delaunator`, applied three refinement rounds against the relief, classified every triangle, and measured the packed bytes. A second script, `scripts/spikes/ground-v2-today-bytes.ts`, measured today's `buildCell` per layer. Six cells were measured: the G0 cells -5_-3, -4_-3 and -4_-4, the belt cell -2_0, Zuid -3_-4, and the west cells -5_-2 and -5_-1.

### The partition is exact

| Cell | Clip, polygon-clipping | Sum of pieces vs cell rect | Max per-class area error, triangles vs partition | Constraint edges that failed in the CDT |
|---|---|---|---|---|
| -5_-3 | 1.2–2.6 s | 992,994 vs 992,994 m² | 1 m² | 0 |
| -4_-3 | 1.5–2.1 s | 992,993 vs 992,993 | 1 | 0 |
| -4_-4 | 0.8–2.7 s | 992,994 vs 992,994 | 0 | 0 |
| -2_0 (belt) | 2.4–4.5 s | 992,993 vs 992,993 | 1–4 | 0–5 of 38,761 |
| -3_-4 | 3.9–4.3 s | exact | 1 | 1 |
| -5_-2 | 3.1–8.3 s | exact | 0 | 0 |
| -5_-1 | 4.8 s | exact | 0 | 0 |

- **No overlaps and no gaps, by construction.** The triangles inside each cell sum to the cell area within 2 m² (rounding).
- **Noding is required.** Before it, 1,192–2,298 constraint edges per cell failed in the CDT (3–7 %), because a partition vertex or Steiner point lay on another edge. After noding (1,927–3,715 splits per cell, tolerance 2 mm) and with Steiner points kept 300 mm off the constraints, 0–5 edges fail.
- **clipper2-js is rejected.** Version 1.2.4 is about the same speed (4.6–12.8 s). Its `Clipper64.execute` returned an empty solution (only the static helpers worked), and its piece areas did not close in 2 of 4 cells (−1.30 and −1.38 km² against 0.99), because of hole orientation under NonZero. It also pulls Angular in as a peer dependency. polygon-clipping is already installed and closed exactly in 7 of 7 cells. Keep clipper2 (WASM Clipper2) as the fallback if bake time ever matters.
- **The CDT library is constrainautor plus delaunator.** cdt2d took 27–50 s on just the 50 k Steiner points with no constraints, so it is rejected. poly2tri was not measured: it needs simple, non-touching polygons per call, and the arrangement has thousands of touching rings. constrainautor handles 66–88 k points in 2.4–7.4 s per pass.

### The drape follows the relief

Steiner points come from a quadtree over the relief: a square splits while the bilinear patch departs more than 5 cm, down to 2 m squares. Boundary edges are split at their midpoint while that point departs more than 5 cm, down to 1 m. Then three refinement rounds insert the centroid of every non-water triangle whose centroid departs more than 5 cm.

| Cell | Points | Triangles | Centroid error p50 / p99 | Area > 5 cm, first pass → after 3 rounds | Max (unresolved) |
|---|---|---|---|---|---|
| -5_-3 | 80.6 k → 88.3 k | 161 k → 176 k | 8 / 48 mm | 19,168 → 1,094 m² | 2.64 m |
| -4_-3 | 66.3 k → 69.6 k | 132 k → 139 k | 7 / 45 mm | 9,652 → 526 m² | 2.67 m |
| -4_-4 | 62.5 k → 68.0 k | 125 k → 136 k | 9 / 346 mm | 10,369 → 705 m² | 3.71 m |
| -2_0 | 79.3 k → 80.8 k | 158 k → 161 k | 7 / 41 mm | 5,510 → 330 m² | 0.64 m |

- **The residual is real vertical features, not noise.** The cells keep 0.03–0.1 % of their area above 5 cm, with maxima of 2.6–3.7 m: quay drops, embankment walls, cut walls and pits beside walls. More Steiner points do not fix these (p99.9 grows in -5_-3 and -4_-4 as the rounds add points there). They need breaklines with duplicated vertices, the "step" constraints below. That is the design's answer, and G2a's gate measures float only where no step constraint applies.
- **Today, for comparison**, the partition layers are 233–243 k triangles per cell (land, areas, parks, roads, garden, open ground). v2 lands at 136–176 k, which is 28–42 % fewer, with no stacked layers.

### Bytes

| | -4_-3 | -2_0 |
|---|---|---|
| Today, partition layers: triangles / compact GPU / gzip if shipped | 233 k / 9.75 MB / 3.26 MB | 243 k / 9.38 MB / 3.38 MB |
| Today, overlay layers (kerb, paint, tram, bollard, hedge, furniture, deck, quay, track, ballast, water) | 95 k / 2.79 MB / 1.04 MB | 183 k / 6.33 MB / 2.00 MB |
| v2 surface, uint16 x/y/z + indices, gzip -9 | 0.99 MB | 1.23 MB |
| v2 surface, meshopt codec (no reorder), gzip | 0.97 MB | 1.15 MB |
| v2 surface at a 10 cm Steiner tolerance (first pass) | 0.69 MB (95 k triangles; area > 5 cm 55,836 m²) | — |
| Today's wire per cell: the cell's own extracts (roads, parks, courtyards, open ground, OSM, water, marks, rail) | 0.17–0.29 MB | 0.29 MB |
| Today's build per cell (Node; the worker is slower on phones) | 3.3–8.8 s | 4.3–10.4 s |
| Of which partition phases (roads, roadRaster, land, areas, parks, pockets) | 4.4 of 8.8 s (50 %) | 3.1 of 5.0 s (63 %) |

- **The wire cost is the main risk.** A baked surface is 0.9–1.2 MB gzip per LOD 0 cell, against today's 0.2–0.3 MB of extracts. That buys 3–4 s of worker CPU per cell. On desktop that is a clear win: 1 MB at 50 Mbit/s is 0.16 s. On a phone on cellular it needs measuring. There are 294 game cells (`gameCells()`), so LOD 0 alone is about 300 MB of deploy. The extract tree is 307 MB today. See Risks and open question 1.

## Decisions, and where this departs from the plan

1. **Integer millimetres in the global game frame, not RD.** The surface extracts (roads-v1, parks, courtyards, open ground) are already stored as 0.1 m integers in the game's local frame (`groundStore.ts toLocal`; `parks.ts decodeLine`). Converting them to millimetres there is exact. Clipping in RD would mean reprojecting BGT twice and rounding twice. Coordinates are measured from the game origin, not the cell: a seam intersection then comes out as the same integer in both cells. Relief sampling stays RD, as today (ground-height-v1 is an EPSG:28992 2 m/4 m grid).
2. **polygon-clipping** (installed) for the arrangement, and **constrainautor + delaunator** for the CDT. Both are pure JavaScript, bake-time only and Node-only. The runtime bundle gains no geometry library. The bake adds `@kninnug/constrainautor` and `delaunator` as devDependencies (integrator: package.json and lockfile).
3. **Phase 1 bakes the surface only.** The plan says the worker build becomes a fallback only. This design gets there in two steps, because baking the overlays roughly doubles the wire bytes (1.0–2.0 MB more gzip per cell, measured). The judge may choose to bake both at once (open question 1).
4. **Steps instead of lifts.** Today's 15–40 mm per-layer lifts (`streets.ts LIFT`, `PARK_LIFT`, `OPEN_GROUND_LIFT`) and the polygon-offset ranks go away for the surface. Only two level offsets are real: the carriageway level (offset 0) and the raised sidewalk, at +0.11 m (`SIDEWALK_TOP − LIFT.carriageway`). Where two pieces with different offsets meet, the shared boundary is duplicated and joined by a vertical strip.
5. **The rider stands on what is drawn.** The main thread's pose and base sampling read the baked triangles of resident v2 cells, through a grid index built at decode. They do not read relief plus inferred decks. Otherwise a lowered under-deck floor or a slot floor would put the rider 0.5–5 m off the drawn ground.

## Data model

### Sheets

A cell holds one or more sheets. A sheet is a planar partition of its footprint, draped by one height function.

| Sheet | Footprint | Height | Count per cell |
|---|---|---|---|
| `ground` | the cell rectangle, minus open water | relief, with level regions overriding it | 1 |
| `floor:<constraint id>` | a tunnel's covered floor (a record's tunneldeel) | the record's floor stations | 0–few |
| `deck:<id>` | reserved, not in v2's first cut: measured canal decks stay overlays (`decks.ts`, bridge kit) | deck profile | 0 |

A **slot or cut** open to the sky is not a separate sheet. It is a level region inside `ground` (the floor), bounded by step breaklines (the walls). A **tunnel** is the only case with two surfaces at one xy. The ground sheet runs over the lid at grade, and the floor sheet runs under it. They join along the portal line, where the floor's end edge is a step breakline against the ground sheet's edge.

### Partition classes and precedence

Precedence runs highest first. A piece is `class ∩ cell − everything above it`. The `layer` column is the `GroundLayer` id the triangles are drawn with (`groundCell.ts GROUND_LAYERS`, unchanged), so materials, tints and textures apply as today.

| Rank | Class | Sources | Layer (material) | Level offset |
|---|---|---|---|---|
| 0 | water (a hole in `ground`) | elevation-v1 water polygons; wetGround deck polygons stay overlays | none (the water and quay overlays draw it) | n/a |
| 1 | carriageway | roads-v1 `c: carriage` (plus a `crossingStrips` footway across the road); OSM carriageway bands where a cell has no roads-v1 (the bands' outline polygons, `streets.ts` band rings) | `asphalt` / `klinker` / `gravel` by `k` | 0 |
| 2 | cycle | roads-v1 `c: cycle` or `k: cycle`; cycleThrough junction-mouth bands | `cycle` | 0 |
| 3 | kerb band | roads-v1 `kerbs` lines buffered `KERB_LINE_M` (0.25 m) into the high side | `kerb` | +0.11 |
| 4 | footway / sidewalk | roads-v1 foot, pedestrian, driveway, island, berm, square; park `path`/`paving` surfaces; OSM footway bands without roads-v1 | `paving` / `klinker` / `brick` / `parkPath` | +0.11 (park paths 0) |
| 5 | rail bed | rail-v1 bed corridors (`railTracks.ts` ballast outline) | `ballast` | 0 (its own height region, `railProfile.ts` levels) |
| 6 | parking | roads-v1 `c: parking`; OSM `parking` areas | `parking` / `asphalt` | 0 |
| 7 | courtyard | courtyards-v1 areas (holes kept) | `garden` / `paving` / park layers | 0 |
| 8 | park | parks-v1 surfaces (lawn, bed, shrub, bark, sand, gravel, pond); roads-v1 `k: grass` / verge | the park layers | 0 |
| 9 | open ground | open-ground-v1 (meadow, shrub, bare, sand) | `lawn` / `shrub` / `bare` / `sand` | 0 |
| 10 | OSM fill | own-ground-osm-v1 areas (park, grass, wood, square, paved, parking), courtyard green by `isCourtyard` | `park` / `wood` / `square` / `garden` | 0 |
| 11 | land | the remainder | `land` | 0 |

Notes:
- **Within one source, BGT is already a partition.** Ranks 1–4, 6 and 8 rarely overlap each other. The precedence decides the cross-extract fights the user saw: open ground against roads, OSM fills against BGT, courtyards against parking.
- **Pockets (`pockets.ts`) and survey gaps go away.** A pocket was bare land that every layer around enclosed. In a partition there is no unowned land under a band, so a pocket is just `land`, or the class that owns it. The junction-gap discs (`SURVEY_GAPS`) become a rank-1 region, carriageway, wherever they paved before (`check-ground-cells --road-regressions` pins them).
- **Each piece carries `{ rank, layer, offset, source }`.** `source` is the extract and feature id, the same codes as `sourceTrace.ts` (`GroundSource`). It feeds the debug section and the audit.

### Constraints

Everything that is not a surface polygon enters as a `GroundConstraint`. This interface is G2c's contract with G3 and with G1.

```ts
// src/canalRecall/ownGround/groundConstraints.ts (new in G2c; types land in G2a so the bake compiles against them)
export type Vec2 = [number, number];               // game frame, metres (the bake converts to integer mm)

/** Where a constraint came from: the audit and the debug section print it; precedence between overlapping ones uses `rank`. */
export interface ConstraintSource {
  kind: 'crossing' | 'cap' | 'cut' | 'deck' | 'quay' | 'relief';
  id: string;                                        // crossing record id, RailViaduct id, Cut id, deck register id, …
  rank: number;                                      // 3 reviewed record, 2 unreviewed record, 1 inferred (G1/tunnels.ts), 0 relief-derived
}

/** A height function over a region (scene z, metres). */
export type Level =
  | { kind: 'flat'; z: number }
  | { kind: 'ramp'; a: Vec2; b: Vec2; za: number; zb: number }            // linear along a→b, constant across
  | { kind: 'stations'; line: Vec2[]; z: number[] }                       // along a centreline (slot floors, rail grade)
  | { kind: 'cap'; z: number };                                           // min(relief, z): G1's deck caps

/** A region whose ground height is not the relief: under a deck, a slot or cut floor, a level crossing. */
export interface LevelRegion { type: 'level'; ring: Vec2[]; level: Level; /** optional class override (a level crossing: carriageway). */ classOverride?: number; source: ConstraintSource }

/**
 * A line the triangulation must follow. `step` absent: a crease (embankment top or foot, deck end), same z both sides.
 * `step` present: the line's vertices are duplicated and a vertical strip joins them (kerb face, cut wall, abutment, quay
 * edge, portal); `material` is the strip's GroundLayer. `pin` fixes the z along the line (a deck end at the deck's z).
 */
export interface Breakline {
  type: 'break'; line: Vec2[];
  pin?: Level;
  step?: { high: 'left' | 'right'; highLevel?: Level; lowLevel?: Level; material: 'kerb' | 'deckBody' | 'quay' | 'land' };
  source: ConstraintSource;
}

/** A covered floor under the ground sheet (tunnel): its own sheet, joined at `portals` (edges of `ring`, by index). */
export interface Covered { type: 'covered'; ring: Vec2[]; level: Level; portals: number[]; mouth: 'dark' | 'none'; source: ConstraintSource }

/** Inference off: the crossing is authored, so tunnels.ts / railSpans.ts / G1 caps must not invent one here. */
export interface Suppress { type: 'suppress'; ring: Vec2[]; what: ('cut' | 'span' | 'cap' | 'portal')[]; source: ConstraintSource }

export type GroundConstraint = LevelRegion | Breakline | Covered | Suppress;

/** All constraints near a cell, from every provider, in a stable order (source.rank desc, then id). */
export function cellConstraints(rect: Rect, providers: readonly ConstraintProvider[]): GroundConstraint[];
export interface ConstraintProvider { name: string; near(rect: Rect, padM: number): GroundConstraint[] }
```

How a level region applies. Inside its ring, the ground sheet's height is the region's `Level`, not the relief. It is a constraint ring, not a class, so the surface classes inside keep their materials: the red cycle path runs through the underpass. Its boundary is a crease. Where a region abuts the relief with a jump of 2 cm or more, the boundary becomes a step, using the `step` material of the provider's choice, or `land` for an inferred one. When regions overlap, the highest `source.rank` wins, then the lowest z (a floor never rises into a deck). A `Suppress` ring removes every lower-rank constraint of the named kinds that it overlaps.

## How each kind of crossing becomes constraints (G2c)

### From G3's records

G3's record (`src/canalRecall/ownGround/crossings.ts`, `data/crossings/<area>.json`) has `kind`, `plan`, `heights`, `ways`, `evidence` and `reviewed`. G2c adds one provider, `crossingConstraints(record): GroundConstraint[]`. It is pure, it lives in `groundConstraints.ts`, and every kind has a unit case. G3 owns the record schema. G2 relies only on the fields below. If G3 renames one, the adapter changes and nothing else does.

| Record kind | Constraints produced |
|---|---|
| rail over road, road over road | `LevelRegion(plan.deck ∩ ground, ramp between heights.under at each open side)`, which removes the saddle; one `Breakline(step)` per abutment wall (`plan.abutments`: high = the bed or approach at `heights.grade` on that side, low = the street, material `deckBody`); `Suppress(['span','cap'])` over the deck. Piers stay objects. The deck mesh stays with `railViaducts.ts` and the bridge kit, which read the same record. |
| road under (slot) | `LevelRegion(slot strip, stations from heights.under along ways.below)`; two wall `Breakline(step)`s, high = the rim (relief, or `heights.grade`), low = the floor, material `deckBody`; `Suppress(['cut','portal'])` over the strip. |
| road under (tunnel) | The slot's constraints up to each `plan.portal`, plus `Covered(plan.tunnel part, floor stations, portals = the portal edges, mouth 'dark')`. The ground sheet runs over the lid at relief. |
| level crossing | `LevelRegion(crossing polygon, level = the road's relief, classOverride = carriageway)` so the rail bed never cuts the road; `Suppress(['span','cut'])`. |
| not a crossing | `Suppress(['span','cut','cap','portal'])` over the record's ring. This alone fixes Kranenbergpad's false 73 m span and the A10-strip portal at Anthony Fokkerweg. |

Rank is 3 when `reviewed` is set and 2 otherwise. A record never loses to an inferred constraint.

### From today's inference (rank 1, used only where no record covers the spot)

| Provider | Today's code | Constraints |
|---|---|---|
| G1 deck caps | `capViaductFloor` generalised (G1 item 1); `RAIL_VIADUCTS`; BGT overbruggingsdeel h ≥ 1 footprints | `LevelRegion(cap)`. If G1 lands as a change to the relief build (`build-ground-height.ts`, as `capViaductFloor` is today), the bake inherits it through `surface.ground` and no provider is needed. Either route works. The provider route is preferred, because a record can then suppress it. |
| tunnels.ts cuts | `Cut` (x, y, floor, left/right, wallL/R, rimL/R) | `LevelRegion(stations)` for the strip; `Breakline(step)` where `wallL/R = 1`, high = rim, low = floor, material `deckBody`; a `Covered` region only with a tunnel way ahead (G1 item 3's rule). This replaces `clipMeshAtCuts` (`tunnels.ts:1159`), the lid meshes and the mask's R-channel cut. |
| railSpans.ts | `RailSpan` | `LevelRegion(cap)` under the span; ends as creases. Skipped when a record suppresses it. |
| decks.ts measured and flat decks | `DeckSurface`, `flatDecks` | a deck-end `Breakline(pin = the deck z at the end station)` so the road partition meets the deck top flush; the deck footprint over land becomes a `LevelRegion(stations)` from the profile (`GroundSurface.deckZ`). Deck bodies and tops stay overlays. |
| quays | water shores (`WaterGeometry.shores`) | `Breakline(step, material 'quay', low = the water's level)`; the quay wall mesh stays an overlay and starts at the same top vertices' z. |
| relief | the DTM | creases where the relief's second difference along a 2 m profile exceeds 0.15 m/m² over at least 6 m (embankment tops and toes). Steps where it jumps ≥ 1.0 m within 2 m along a line at least 4 m long and no other constraint is there (walls the survey missed). |

### Kerbs

For each roads-v1 `kerbs` line, add a `Breakline(step, material 'kerb', high = the sidewalk side)` and the 0.25 m kerb band (rank 3). The strip runs from `KERB_TOP` down to the carriageway level. That reproduces today's `KERB_FACE_BOTTOM`, with no `KERB_FACE_BOTTOM` overlap needed. Lowered kerbs (an inrit) are `driveway` pieces at the same level. Where the survey has none, there is no step.

## The bake (G2a)

`npm run ground:bake` runs `scripts/own-ground/bake-ground.ts`. Its output goes to `artifacts/ground-v2/staging/`, and the integrator publishes it to `public/data/extracts/amsterdam/ground-v2/`. Options: `--changed`, `--cells=a,b`, `--near=<lng,lat>`, `--lod=0|1`, `--debug` (adds the source section), `--workers=N` (default: cores − 2). The HELP constant prints them.

Per cell:
1. **Inputs.** `GroundStore.cellInput(key, 0)`, the same call the worker and `check-ground-cells.ts` make, so data loading is not forked. Add `cellConstraints(rect, providers)` with a 200 m pad (`CELL_INPUT_PAD_M`).
2. **Pieces.** Convert every source ring to integer mm in the global game frame. Clean them with a polygon-clipping self-union per feature (repairs bowties and duplicate rings). Clip to the cell rect, which is `cellRect(key)` rounded to mm by the one shared function `cellRectMm`.
3. **Arrangement.** Walk the precedence: `piece = (∪ class) − taken`; `taken ∪= class`; land = rect − taken. Measured at 0.8–8.3 s per cell.
4. **Constraint rings.** Level regions, covered rings, suppress rings and breaklines are clipped to the cell (pad 0). Level and covered rings split the pieces they cross, through a polygon-clipping intersection and difference per piece; the piece keeps its class.
5. **Noding.** Split every segment at any vertex within 2 mm of its interior, then deduplicate edges (measured: 1.9–3.7 k splits per cell). Snap vertices within 2 mm to one. An edge shorter than 20 mm after snapping collapses into its endpoint. This is the sliver gate's source.
6. **Densify** boundaries and breaklines by midpoint error (5 cm, down to 1 m). Along the cell seam, also insert points at every 2 m of the global grid, so both neighbours hold the same seam vertices whatever lies inside them.
7. **Steiner points.** A relief quadtree at 5 cm and 2 m squares, rooted on the global 1,024 m grid so seams agree. Points within 300 mm of a constraint are dropped.
8. **CDT** (constrainautor): every piece edge and breakline is a constraint. Then up to three refinement rounds of centroid insertion where the error is above 5 cm, excluding triangles touching a step line.
9. **Classify** each triangle by flood fill from its piece's edges. The spike used a centroid parity test: 0.9–3 s per cell, 0–1 ambiguous triangles. Drop water. Duplicate step vertices, assigning each triangle to its side, and emit the strips.
10. **Heights.** `z = level(x, y) + offset(class)` per vertex. The height function is constraints (by rank) over `surface.ground`. Normals come from the analytic relief gradient, or the level's plane, not from face averages. A seam vertex then gets the same normal in both cells, and the shading has no seam.
11. **Self-check** (the bake fails the cell, keeps the old one, and reports it): area closure within 2 m² per cell; no constraint failures other than ones logged with an id; no triangle under 0.01 m² with an aspect over 20; float within 5 cm outside step lines at p99.9; seam vertices identical to the neighbour's when the neighbour is already baked.
12. **Write** the cell (format below) and its `meta` entry: input hashes, stats, timing.

**LOD 1** uses the same partition, simplified topologically. Each shared arc is simplified once (Douglas–Peucker, 0.5 m), so both sides keep matching. Steiner tolerance 15 cm, 4 m squares, no kerb band and no steps under 0.2 m. Its bytes are estimated at about a quarter of LOD 0's, which is not measured. Touch detail (`CellDetail 'touch'`) reads LOD 0 files; its savings came from the overlays, which phase 1 still builds.

**Change detection** copies `scripts/world/pipeline.ts inputHash`. Each cell records the hash of every input file it read (its 3×3 neighbourhood's roads, parks, courtyards, open ground, OSM, water, rail and marks cells, the relief tiles under the cell plus the pad, and `data/crossings/*.json`), plus a `CODE` list of the bake's own sources. `--changed` rebuilds a cell when any of these differs.

**Bake time.** The spike took about 10 s per cell for clip + CDT (single pass) plus about 1 s for inputs, and 11–61 s with three refinement rounds. Most of that is re-triangulating from scratch each round; constrainautor can add points incrementally. Budget: ≤ 30 s per cell at p95. That is 294 cells × 30 s / 8 workers ≈ 20 min for the city. `--changed` after a typical extract update is minutes.

**Determinism.** Same inputs, same bytes: sources are sorted by id, coordinates are integers, and there is no `Math.random`. The bake runs under `useBrowserMath.ts`. G2a pins it with a test that bakes two cells twice and compares the bytes, as `groundDeterminism.test.ts` does for the worker.

## The cell format (GRD2)

The format is little-endian. The whole file is gzipped on disk (`.bin.gz`), or served with Content-Encoding as the hosting does today (open question 3).

```
header   'GRD2' u32 · version u16 (1) · flags u16 (bit0 debug, bit1 overlays present) · key i16 i16 · lod u8 · pad u8
         rect: 4 × f64 (cellRect, the exact floats the runtime computes; a decoder asserts equality)
         zBase i32 (mm) · counts: vertices u32, triangles u32, groups u16, sheets u8, steps u32
         inputsHash 16 B · codeHash 16 B
vertices x u16[V], y u16[V]      normalised to the rect: 0 and 65535 decode to the rect's edges exactly (seams bitwise equal)
         z u16[V]                mm above zBase (range checked at bake: 65.5 m per cell)
         n i8[2V]                octahedral normal
groups   per group: layer u8 (GROUND_LAYERS index) · sheet u8 · tile u8 (0..8, the 3×3 cellTiles grid) · pad · first u32 · count u32
         triangles are sorted by (layer, tile) so one draw range per layer per tile
indices  meshopt index codec (three/examples/jsm/libs/meshopt_decoder.module.js; already shipped), or u16/u32 raw + gzip
seam     per side: count u16 + vertex ids (u32) of seam vertices in order (for the audit and the pose index)
steps    per strip: layer u8 · first u32 · count u32 into the same index stream (kerb, deckBody, quay faces)
debug    (flag bit0) per triangle: source u8 (sourceTrace GroundSource) + piece id u32; per constraint: id string
```

The x/y quantum is 1000 m / 65535, which is 15.3 mm. That suits the ground's look, because the edges inside a cell share vertices by index, so the quantum cannot crack anything. At seams, the decoder maps 0 and 65535 to the exact rect floats that both cells compute with the same `cellRect`, so seam vertices are bitwise equal in both cells. Step vertices share their xy by construction. z has a 1 mm quantum.

**Size budget, LOD 0.** p50 ≤ 1.1 MB and p95 ≤ 1.5 MB gzip per cell. The measurement is 0.81–1.23 MB before kerbs and steps; with meshopt and a vertex-fetch reorder it is expected about 20 % lower, which is not measured. **LOD 1:** ≤ 0.3 MB. **GPU:** a decoded cell is Float32 positions (the materials read `uv = position.xy` from the same buffer, `compactMesh.ts`), Int8 normals and u16 or u32 indices. That is about 3–4 MB per LOD 0 cell, against 9.4–9.8 MB for today's partition layers. That is 60 % less, well inside the plan's +30 %.

## The runtime loader (G2b)

- **The flag.** `?groundV2=1` (window `__canalRecallGroundV2`) turns it on. The default stays off until G2d. `?groundV2=0` is the explicit before for one week after the flip.
- **The manifest.** `ground-v2/index.json` lists `{ key: { lod0: hash, lod1: hash, bytes } }` and the format version. `GroundStore` reads it with the other indexes. A cell that is missing, or whose `inputsHash` does not match, falls back to the worker build for that cell only, and counts as `stats.v2Fallback`.
- **Fetch and decode in the ground worker.** It is already a worker with the extract fetchers, the share host (`groundShare.ts`) and the transfer path. A new message, `{ type: 'v2', key, lod }`, makes the worker:
  1. fetch the file and run the meshopt decode (WASM, already in three);
  2. dequantise into one Float32 position array, one Int8 normal array and one index array per layer, with `tiles` taken from the groups (so `cellTiles.ts` cutting is free);
  3. run the overlay build (phase 1): `buildCell(input, { surface: false })`, a new option that skips `roads`, `land`, `areas`, `parks`, `courtyards`, `openGround` and `pockets`, and keeps streets paint, tram, kerb lines on OSM-only cells, bollards, rails, markings, water, decks and quays;
  4. post one `BuiltCell` whose `layers` merges the decoded surface layers with the overlay layers.

  `install()` does not change. The layers can share one vertex buffer (three `BufferAttribute`s on one `ArrayBuffer`, an index per layer). That matches the plan's "one vertex buffer per cell" while keeping one mesh per layer, so polygon offsets, `CUT` mask clones, the fade and `UNGAINED` all keep working.
- **The mask.** Partition layers need no water cut, because water is a hole. In v2 the `CUT` table drops the surface layers, and only the overlay street bands keep the G channel. When the overlays are baked too (phase 2), the mask goes.
- **Polygon offsets.** These stay on the overlays (paint over asphalt, and so on). The surface layers draw at offset 0. Two adjacent pieces never overlap, so no rank is needed.
- **The riding surface.** On decode, the main thread receives the same positions. With `releaseArrays` on phones it keeps a copy of positions and indices, about 1.5 MB per LOD 0 cell, and builds a 4 m bucket grid of triangle ids, estimated at about 20 ms per cell (not measured). `surface.ts riderPose` and `footprintBase` query it first, then fall back to relief plus decks off the v2 cells. The worker-built path keeps today's sampling.
- **Far ring** (`farRing.ts`) and **overview tiles**: unchanged.
- **Time-to-ride.** First paint waits on the fetch and decode, about 50–150 ms per cell (estimated). Today it waits on a 3–9 s worker build. Phase 1 still runs the overlay build, which is 37–50 % of today's time, but the surface can install first. The installer gets a two-step install per cell: surface, then overlays.

## Migration and flags

1. **G2a** ships the types, the bake, staged cells for the named places' cells plus the top 50, and the audit runner. It makes no runtime change. The integrator publishes `ground-v2/` (staged → reviewed → published, per CLAUDE.md).
2. **G2b** ships the loader behind `?groundV2=1`, Storybook states (desktop and phone; one per named place, with a fixed pose), and an e2e ride spec over two named places.
3. **G2c** ships the constraint providers. Records come from G3 once they exist, inferred providers otherwise. Then the bake is re-run with `--changed`.
4. **G2d** turns `groundV2` on by default after the user rides the named places. The old path stays behind `?groundV2=0` for a week. Then `clipMeshAtCuts`, the lids, `pockets.ts`, the surface half of `CUT`, and the per-layer lifts are deleted, in a separate commit, with `check:canal` green.

Today's A/B flags on v2 cells:

| Flag | Under v2 |
|---|---|
| `?openGround=0`, `?roads=…`, `?parks=0`, `?courtyards=0` | Read only by the worker path. A v2 cell is baked with the defaults. `?groundV2=1&openGround=0` falls back to the worker for every cell and logs it, so A/B stays possible. |
| `?portalClip`, `?portalEnds`, `?railSpans`, `?dryWayDecks` | The worker path only. Their v2 equivalents are bake options (`--no-crossings`, `--no-inferred=cut,span`) used to stage A/B variants under `artifacts/ground-v2/variants/<name>/`. A dev-only `?groundV2Variant=<name>` reads them from there. |
| `?groundTiles`, `?groundNearTiles` | Honoured: the groups carry the tile index. |
| `?groundDetail=touch` | Honoured for overlays. The surface is LOD 0 or LOD 1 only. |

## Gates

| Gate | Measure | Number |
|---|---|---|
| **G2a** partition | G0's `ground:audit`, which reads `.bin` files when given `--v2`: slivers (aspect > 20 and area > 0.05 m²), poke-through, z-fight (different extracts within ±5 mm), cracks | **0** on all 8 named places and G0's top 50 cells |
| | area closure: sum of triangles vs cell rect | within 2 m² per cell, every cell (spike: ≤ 2) |
| | float above the relief outside step lines and level regions | p99.9 ≤ 5 cm, max ≤ 10 cm; the steps' list printed |
| | constraint failures | 0 unexplained; each failure listed by edge and source id |
| | seams | 100 % of seam vertices bitwise equal to the neighbour's (x, y, z, normal) on all baked pairs |
| | determinism | two bakes byte-identical |
| | bytes | LOD 0 p50 ≤ 1.1 MB, p95 ≤ 1.5 MB gzip; LOD 1 ≤ 0.3 MB; city total reported |
| | bake time | p95 ≤ 30 s per cell (one core) |
| **G2b** runtime | look parity | Storybook and H10-style ride frames, beside the orthophoto, at the 8 named places plus Westerkerk, Vondelpark and Rembrandtplein (desktop and phone); judged on the look first |
| | GPU bytes per resident LOD 0 cell | ≤ today's partition plus overlay layers (measured today: 12.5–15.7 MB; expected 6–9 MB), within the plan's +30 % |
| | wire | the 3×3 start ring's first-paint bytes reported, today vs v2 |
| | desktop time-to-ride (`CANAL_PW_TIMING=1`, the user's Mac pose) | no worse, at p50 over 5 runs |
| | worker build ms per cell in phase 1 | ≤ 50 % of today's on the same cells (spike: the partition phases are 50–63 %) |
| | pose | rider z vs drawn ground within 1 cm along the e2e ride (a new check in the ride spec) |
| | `check:canal`, `world:verify`, `check-ground-cells.ts` (both paths) | green |
| **G2c** crossings | per named place: deck saddles (relief bump > 0.3 m under a deck) | 0 |
| | unbound portals (a mouth without a `Covered` or a tunnel way) | 0 |
| | `check:tunnels` (19 sites) and `check-rail-street.ts` | green, re-pinned to records |
| | cut walls and floors sharing edges with the ground | 0 cracks along step lines (audit) |
| | headroom: ground under a deck ≤ soffit − 2.5 m (cycle) or − 4.2 m (road) where a record gives the soffit | 0 violations |
| **G2d** flip | the user rides the named places | approval in the issue |
| | Sentry / feedback week | no new ground reports at named places |

## Risks

1. **Wire and deploy size.** This is measured, not estimated: 0.8–1.2 MB per LOD 0 cell, about 300 MB across 294 cells, against 0.2–0.3 MB of extracts per cell today. Mitigations, in order of cost:
   - meshopt reorder plus the codec (about 20 % less, not measured);
   - a 7.5 cm Steiner tolerance on flat land classes, keeping 5 cm on roads (at 10 cm the spike went 0.99 → 0.69 MB, but the area over 5 cm grew to 5.6 %);
   - z coded as a delta from the relief (`ground-height-v1` is resident on the main thread anyway). Most vertices then code to 0, at the cost of a decoder dependency on relief arrival;
   - baking ride-priority cells only (`ridePriority.ts` T0/T1), with the worker everywhere else.

   The hosting-quota prune (deploys keep 3) means per-deploy upload matters more than total size. Cells are content-hashed, so unchanged cells upload once if the deploy dedupes; this is unverified (open question 3).
2. **Relief noise drives the point count.** 42–60 k of 62–88 k points are Steiner points over 2 m AHN with fill and smoothing. Smoothing the relief further would cut both bytes and triangles, but it is a look change. It is out of scope, and noted for the judge.
3. **Vertical features without a source.** These are walls the survey and records miss: the 2.6–3.7 m residuals in -5_-3 and -4_-4. The relief-step provider catches the large ones. The rest stay as steep triangles, which is today's look, but the float gate excludes them only when listed. G2a must print their positions, so G3 or a human can confirm them.
4. **Look parity.** Without lifts, the polygon-offset ordering among surface layers disappears. Any material that relied on drawing over another (for example a translucent park layer) will look different. Today's look also includes things v2 removes on purpose (shards, poke-through). Parity is judged on frames, not pixels.
5. **Seam determinism across code changes.** If one cell is rebaked with new code and its neighbour is not, the seam points may differ: different densification or different Steiner points would mean T-junction cracks. The fix: the seam points come only from the global 2 m seam grid plus the crossings of input edges, never from refinement, and the gate checks every baked pair. `--changed` also rebakes neighbours when `CODE` changes.
6. **The pose index on phones.** It keeps positions and indices on the CPU (about 1.5 MB per cell). It needs measuring under `releaseArrays`.
7. **G3 schema drift.** G2 binds only to the fields in the adapter table. G3's types should export a `CrossingRecord` with those names, and a test in G2c fails on a missing field.
8. **constrainautor robustness.** 0–5 of up to 38 k edges failed after noding. A failure leaves the edge's two sides unconstrained, so classification by flood fill could leak across. Mitigation: flood fill uses the piece edges as recorded, not the CDT's flags; the self-check compares areas per class, so a leak over 2 m² fails the cell.
9. **Two paths for a while.** Every ground fix in the next weeks must land in both the worker path and the bake, or the bake must reuse the worker's code. Reuse is the design's rule: inputs, classes, materials, levels and overlays are the worker's code. Only the partition and the CDT are new.

## Lanes, order and files

- **G2a** (opus, about 1 day): the bake.
  - New files: `src/canalRecall/ownGround/groundConstraints.ts` (types plus `cellConstraints`), `src/canalRecall/ownGround/groundPartition.ts` (arrangement, noding, densify, Steiner, CDT, classify; pure), `src/canalRecall/ownGround/groundV2Format.ts` (encode and decode, shared by the bake and the worker), `scripts/own-ground/bake-ground.ts`, and tests (`groundPartition.test.ts` on synthetic rings: closure, noding, seams, steps; `groundV2Format.test.ts` round trip).
  - The G0 audit learns `--v2`.
  - Integrator: devDependencies `delaunator` and `@kninnug/constrainautor`, `npm run ground:bake`, publishing `ground-v2/`.
- **G2b** (opus, about 1 day): the loader in `groundWorker.ts`, `buildCell`'s `surface: false`, `gameGround.ts` (manifest, two-step install, pose index), Storybook states, an e2e spec. Integrator: bundles.
- **G2c** (opus, about 1 day after G3 has records for the named places): the providers (crossings, caps, cuts, spans, decks, quays, relief), the adapter tests, and re-pinning `check:tunnels` and `check-rail-street.ts`.
- **G2d** (sonnet): the flip, the cleanup commit, What's New.
- G2a and G2c's inferred providers can start at once. G2c's record provider waits for G3's first reviewed area (the 8 named places).

## Open questions for the judge

1. **Phase 1 surface-only, or bake the overlays too?** Surface-only adds about 1 MB of wire per cell and keeps a lighter worker. Baking everything adds 2–3 MB and removes the worker. The design recommends surface-only first, with time-to-ride measured on the user's Mac and iPhone before phase 2.
2. **Is about 300 MB of baked ground acceptable for hosting,** or should G2a bake ride-priority cells only (T0/T1, about 60 cells, about 70 MB) and leave the rest on the worker?
3. **Does the deploy upload only changed files** (content-hashed) and serve `.bin` with gzip? This decides whether to gzip on disk.
4. **Relief smoothing** (Risk 2) is the cheapest byte win, but it changes the look. Should it go in G2a, or stay parked?

## Spike files

- `scripts/spikes/ground-v2-partition.ts`: the partition, CDT and refinement spike. Run it as `G2_DEPS=<scratch>/node_modules npx tsx scripts/spikes/ground-v2-partition.ts [key …]`, with clipper2-js, constrainautor, delaunator and cdt2d in a scratch npm prefix (never the shared node_modules). Options: `G2_CLIPPER=1`, `G2_CDT2D=1`, `G2_REFINE=n`, `G2_TOL=m`.
- `scripts/spikes/ground-v2-today-bytes.ts`: today's `buildCell` per layer (triangles, compact GPU bytes, gzip), partition vs overlay layers.
