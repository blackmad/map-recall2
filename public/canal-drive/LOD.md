# Building levels of detail: plan and status

## Goal

Make the city recognisable at driving scale without requiring every building to
be a handcrafted asset. Amsterdam should be complete and stable when offline,
gain real roof silhouettes as detail streams in, and reserve authored models
for the handful of landmarks where windows, ornament and architectural identity
materially improve navigation.

This is a fidelity ladder, not a contest between data sources. BAG and 3DBAG
provide authoritative identity and measured Dutch geometry. OSM contributors
often describe structure that an automated reconstruction does not express.
Curated GLBs provide detail neither source can infer. The pipeline must retain
the best information from each while rendering exactly one representation of a
building at a time.

## What the levels mean

### LoD1: complete measured massing

An LoD1 building is its ground footprint extruded to a flat roof.

It provides:

- complete city coverage;
- stable BAG `pand_id` identity;
- measured AHN-derived height where available;
- small, independently streamable vector tiles;
- fast MapLibre rendering and a dependable offline fallback.

It does not provide pitched roofs, ridges, dormers, towers, façade articulation
or ornament. A single extrusion is particularly weak for a tower on a broad
podium: one percentile cannot describe both heights.

### LoD2.2: reconstructed building surfaces

3DBAG LoD2.2 reconstructs semantic wall and roof surfaces from BAG and AHN.
Compared with LoD1 it adds pitched and stepped roof planes, ridges, multiple
building parts and much better silhouettes. It also provides reconstruction
quality metadata that can determine whether a building is safe to promote.

LoD2.2 is still not a handcrafted architectural model. It generally has no
window geometry, doors, sculptures, façade ornament or authored textures. Its
automated interpretation can also lose a structural distinction already mapped
in OSM.

### Signature model: curated authored detail

A signature model is a positioned GLB/glTF asset for a small number of
destinations such as Paleis op de Dam, Rijksmuseum, Amsterdam Centraal,
Westerkerk or NEMO. It can carry recognisable façade detail and materials that
neither an extrusion nor an aerial reconstruction contains.

Signature models are the highest visual tier, but never the city foundation.
Each needs an attribution record, geographic transform, performance LODs,
stable building aliases, and the same picking/highlight behaviour as every
other building.

## The source rule: preserve manual OSM at every level

Manual OSM geometry must be evaluated before selecting **any** fidelity tier.
Do not interpret “3DBAG exists” as “replace OSM.” In particular, retain useful:

- `building:part` compositions;
- `min_height` and raised or stacked volumes;
- towers, domes, wings and podiums;
- passages and deliberate voids;
- courtyards and complex outlines;
- roof shape/direction where it resolves an automated ambiguity;
- building and part heights where measured geometry is absent or clearly
  inferior.

This does not mean drawing OSM and 3DBAG on top of each other. The offline
resolver compares all candidates belonging to a BAG building or building
group, then emits one coherent representation. A useful OSM composition may be
retained with 3DBAG-derived measurements attached to compatible parts. If the
sources cannot be merged safely, the richer trustworthy representation wins as
a whole.

### Per-building precedence

The default decision order is:

1. A reviewed signature model, if loaded and valid.
2. A resolved OSM/3DBAG detailed composition that preserves manual topology and
   uses measured LoD2.2 surfaces where compatible.
3. Pure 3DBAG LoD2.2 when reconstruction quality passes and it loses no
   meaningful manual structure.
4. Manual OSM building parts when they express materially richer or more
   correct topology than 3DBAG.
5. 3DBAG LoD1 measured extrusion for ordinary buildings.
6. Plain OSM extrusion when BAG/3DBAG is missing or rejected.

“Higher” is not automatically “better.” The resolver records why a candidate
won, which sources were consulted, and why any richer-looking candidate was
rejected.

## One owner per building

At runtime a BAG building has one geometry owner. When a higher tier becomes
ready, the renderer suppresses the lower tier by stable building identity only
after the replacement has loaded successfully. Failure, eviction or WebGL
context loss reveals the fallback again.

Never hide buildings with a rectangular tile mask. It can erase nearby roads
and fallback buildings while detailed geometry outside the visible tile leans
into the camera. Never leave both representations visible: coplanar walls cause
z-fighting, roofs double, picking becomes ambiguous, and highlights disagree.

Identity is independent of fidelity:

- canonical Dutch key: BAG `pand_id`;
- aliases: OSM way/relation/part IDs and game landmark IDs;
- signature asset ID: an additional alias, never a replacement for `pand_id`;
- surface IDs: scoped to a pinned 3DBAG release and never used as durable game
  progress keys.

## Appearance is separate from geometry

Choosing geometry does not choose colour. Wall and roof appearance resolve
independently through:

1. reviewed override;
2. explicit valid OSM material/colour;
3. measured PDOK or point-cloud observation;
4. reviewed high-confidence classification;
5. construction-age/use/material prior;
6. controlled neutral fallback.

An observation retains source, date, method, confidence and rejection reason.
Changing the geometry tier must not silently discard measured colour, and a new
measurement must not destroy the OSM tag it superseded.

## Current state on `main`

### OSM/OpenFreeMap fallback — live

The ordinary `building-3d` layer supplies broad city coverage from OpenFreeMap
building data. It preserves citywide OSM `render_min_height` and building-part
massing where the basemap contains them, but many heights are tagged estimates
or generic fallbacks rather than AHN measurements.

### OSM appearance overlay — live but partial

`buildings-colored.geojson` contains 10,578 appearance-backed OSM buildings.
The renderer draws separate wall extrusions and artificial flat roof caps;
5,778 buildings currently have a sampled aerial roof colour. This improves
colour for part of the city but is not a complete geometry source.

The file is filtered by appearance. It must never be used as if it were the
complete set of manually mapped OSM buildings or parts.

### Hosted 3DBAG LoD2.2 — live and optional

“Detailed 3D” streams the pinned 3DBAG v2025.09.03 Cesium 3D Tiles set through
the shared MapLibre/Three.js context. It renders real roof geometry and can
highlight an individual mesh feature. When enabled it currently hides the
basemap and coloured OSM building layers, so the best geometry becomes uniform
and loses measured appearance.

The hosted tiles expose BAG IDs through structural metadata. A Rijksmuseum-area
probe found a unique `NL.IMBAG.Pand.*` identity for all 667 sampled features,
so runtime identity joins are feasible. Production should still prefer pinned,
owned assets so an upstream republish cannot silently change the game.

### Signature models — demo only

Thirteen curated GLBs ship under `public/canal-drive/models/` and draw in
`signature-landmark-demo.html`. They are disabled in the live game after a
playtest found them too slow and Centraal still carrying its SketchUp ground
plane. See TODO item 22.

## Complete LoD1 branch status

`feat/lod1-building-city` contains the substantial unmerged implementation:

- reads the 3DBAG FlatGeobuf tile index and pinned CityJSON tiles;
- fetches 290 adaptive source tiles covering the drivable Amsterdam area;
- builds 336,784 buildings, 336,431 with AHN-derived measured heights;
- assigns stable BAG identities and retains OSM aliases;
- merges BAG candidates with available OSM parts;
- cuts the output into z14 vector tiles;
- streams roughly 9–19 tiles as the camera moves;
- delivers about 15 MB gzipped citywide, with a 6 KB median tile;
- includes a side-by-side driving comparison page and focused unit/e2e checks.

The branch currently resolves 336,620 measured extrusions, 1,163 hand-mapped
OSM parts standing in for 164 BAG buildings, and unmatched OSM fallback
features. It is not ready to merge because the comparison exposed two genuine
losses.

### Blocker 1: incomplete manual OSM input

The resolver reads `buildings-colored.geojson`, which contains only buildings
with appearance data. Manual OSM parts without colour tags never reach the
decision. Magna Plaza has no appearance-tagged feature nearby and collapses
into 48 plain BAG boxes even though the live basemap contains a stepped manual
composition.

Fix: build a complete OSM building/part input independent of appearance. Join
appearance afterward. Add representative regression locations—Magna Plaza,
the Waag, a canal-house row, a raised part and a courtyard—to prove manual
topology survives regardless of colour coverage.

### Blocker 2: towers flattened to podium height

LoD1 uses 3DBAG `b3_h_dak_70p`, the correct ordinary LoD1.2 extrusion height.
For a slim tower on a broad podium, however, most roof points belong to the
podium. In the staged city 201 BAG buildings render more than 10 m below their
AHN ridge, 66 by more than 20 m, and 21 by more than 40 m.

Fix: detect multi-height/tower candidates using the roof percentile, maximum,
ridge, footprint, OSM parts and LoD2.2 surfaces. Prefer a resolved multi-part
composition. Where only one extrusion is possible, use an explicit reviewed
rule rather than silently flattening the skyline.

## Delivery plan

### Phase 1 — make LoD1 a strict improvement

1. Ingest every OSM building and `building:part`, not the colour-filtered set.
2. Separate geometry resolution from appearance resolution.
3. Add tower/podium detection and a multi-part or reviewed height decision.
4. Regenerate the city and run the comparison routes.
5. Require no loss at named manual-geometry fixtures.
6. Publish the BAG-keyed z14 city only after the existing basemap layer can be
   removed without a visual or interaction regression.

This is the next shippable milestone.

### Phase 2 — reconcile LoD2.2 with manual OSM

1. Pin a small representative LoD2.2 sample containing landmarks, terraces,
   towers, flat roofs and courtyards.
2. Compare semantic 3DBAG parts with complete OSM part graphs per BAG building.
3. Define deterministic preservation signals: vertical stacking, deliberate
   voids, part count, boundary agreement and measured reconstruction error.
4. Emit one resolved detailed asset with source decisions in its manifest.
5. Replace fallbacks building-by-building after successful tile load.
6. Carry measured roof/wall appearance into semantic surfaces.

### Phase 3 — signature landmark proof

1. Acquire Paleis op de Dam with author, source URL and CC BY attribution.
2. Preserve an archival original; normalize a runtime GLB offline.
3. Produce bounded LODs and textures, record every modification, and measure
   compressed bytes, decode time, draw calls and GPU memory.
4. Align it to its BAG footprint, ground altitude, heading and real height.
5. Suppress only its resolved lower-tier building IDs after the GLB loads.
6. Make footprint clicks, mesh clicks, active highlight, `hide_3d`, camera
   transitions and context recovery resolve to the same landmark.
7. Compare it in a real driving route, including the mobile performance target.

If the proof materially improves recognition, repeat selectively for
Rijksmuseum, Amsterdam Centraal, Westerkerk, NEMO and the Maritime Museum.

### Phase 4 — widen detailed coverage only when it pays

Tile resolved LoD2.2 assets around the camera with bounded concurrency,
eviction hysteresis and a normal LoD1 fallback. Expand first by visual and route
value, not by raw building count. A detailed tier that cannot meet mobile byte,
decode and frame-time budgets stops at signature landmarks.

## Acceptance gates

### Geometry and coverage

- Every drivable-area building has exactly one visible representation.
- Complete manual OSM geometry is consulted before every ownership decision.
- Named complex fixtures retain towers, stacking, passages and courtyards.
- No duplicated walls, roofs, z-fighting or tile-edge erasure.
- Missing or rejected measurements are labeled as fallback, never invented.

### Interaction

- BAG, OSM and landmark aliases resolve consistently across all tiers.
- Mesh and footprint clicks select the same feature.
- Highlighting, visibility toggles and camera transitions survive promotion and
  fallback.
- Failed, slow or evicted detail leaves a visible clickable LoD1 building.

### Performance

- Measure compressed transfer, parse/decode time, resident tile bytes, GPU
  memory and draw calls on desktop and the mobile test target.
- Loading is spatially bounded and never forces continuous repaint while idle.
- The complete fallback remains useful before any detailed tile arrives.

### Reproducibility and provenance

- Pin BAG/3DBAG/OSM/imagery versions and content hashes.
- Record the winning geometry source and rejected alternatives per building.
- Keep model creator, source URL, license and modification history in the asset
  manifest and visible attribution surface.
- Regeneration is deterministic and review overrides survive geometry releases
  by keying on BAG identity and surface kind, not unstable surface indices.

## Immediate next actions

1. Rebase `feat/lod1-building-city` onto current `main` without publishing its
   staged data.
2. Build the complete OSM building/part input and fix the Magna Plaza class of
   regression.
3. Implement and test the tower/podium resolver.
4. Rebuild the comparison city and decide whether LoD1 is now a strict visual
   improvement.
5. In parallel only after the foundation is stable, acquire and inventory the
   Paleis op de Dam GLB for the signature-model proof.
