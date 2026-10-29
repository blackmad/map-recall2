# What Slop New York teaches Canal Recall, and the lanes that follow (2026-10-29)

The user asked (2026-10-29): look at https://github.com/mrdoob/slop-newyork and
write handoff docs for opus with a plan based on what we learn. Evidence with
file references: `docs/research/slop-newyork-20261029.md`. Lane briefs:
`docs/handoffs/lane-*-20261029.md` listed in §4. Rules: `LANE-RULES.md`.

## 1. The short version

Slop New York is a 1:1 Manhattan in 33.5k lines of plain three.js, built in
ten days, with no map library, no image textures and no audio files. Its
37,353 building footprints weigh 441 KB; each building is two triangles per
wall plus a roof, and every window, storefront, brick, ghost sign and lit room
is computed in one shader from two vertex attributes. Our generic buildings
spend about 219 triangles a building on extras, our building tiles weigh
18 MB plus 16 MB, our iPad main pass is 1.13–1.36 M triangles after this
week's cuts, and we still run MapLibre under three.js although the user said
go on dropping it on 2026-10-10.

Five things are worth taking, in this order: (1) finish letting three.js own
the frame, which every other item assumes; (2) the shader-facade building
model for the ordinary ring, keeping our measured kits and landmarks where
they are; (3) compact binary extracts with strict decoders; (4) shadow
stand-ins, size-based culling and the loading recipe; (5) the driving-feel
fundamentals (fixed substeps with a display-rate agreement test, a
speed-dependent steering lock, entity-relative camera smoothing). A sixth, the
raster-derived ground, is a measured spike, not a rollout. Traffic,
pedestrians, time of day and audio are product questions for the user, not
lanes, and are on the GitHub issue that accompanies this plan.

## 2. Where we are already ahead (do not regress these)

- **Camera.** Our chase camera has a 10° yaw dead band, a slower ease and an
  80°/s cap (`cameraYaw.ts`, 2026-10-29) and a clearance guard against
  footprints. Slop's follows the heading directly with no dead band, no rate
  cap and no building avoidance at all.
- **Likeness.** Our buildings are measured per pand (3DBAG heights and roof
  planes, photo-measured colours, window kinds, kits per buurt, 355 bespoke
  landmark GLBs fitted to BAG footprints). Slop picks a material from the
  decade (limestone or glass), draws every roof flat and fits its dozen
  landmarks to an OSM bounding box. The user's acceptance bar is likeness to
  the photo; nothing below weakens that.
- **Ground.** AHN relief, per-polder water levels, 931 measured bridges, BGT
  surfaces, photo-evidenced road marks. Slop's ground is a flat plane at
  y = 0 with a 1 m raster of blocks.
- **The game.** Spaced repetition, the question budget, spoiler rules, routes,
  transit, ferries, feedback, Sentry, a render governor, 153 Playwright specs
  and CI. Slop has none of this; it is a sandbox.
- **Phones.** We measure iPhone and Android and have a governor; slop renders
  at pixel ratio 1 everywhere and otherwise ignores phones (its mini fork cut
  the world to 2 km to survive an iPhone 14 Pro).

## 3. Where slop is ahead, filtered by our principles

Filters applied: geographic learning outranks spectacle; the corridor stays
visible; open data only; desktop frame time matters ~10× iPhone; no more
hand-modelled ordinary houses; likeness, not gates, is acceptance.

| Area | Slop | Us today | Verdict |
|---|---|---|---|
| Frame ownership | three.js owns canvas, camera, labels, picking | MapLibre + three custom layers; `?ownMap=1` branch dead since 10-10 | **Lane A**, backbone |
| Ordinary buildings | 2 tris/wall, facade in shader, 288 cell meshes, 5 materials | ~219 tris/building extras, DataArrayTexture bays, facade chunks + 3×3 tiles | **Lane B** for the ordinary ring; kits/recipes/landmarks stay |
| Footprint data | 441 KB for 37k buildings, strict binary decode | 18 MB bag-tiles + 16 MB building-tiles (296 geojson.gz) | **Lane C** |
| Trees data | 123 KB for 70k points | 6.2 MB tiles for 311k + 1.7 MB json | Lane C |
| Shadows | position-only stand-ins per 500 m cell, 35–50 draws saved | every caster draws its full material into the 2048² map | **Lane D** |
| Culling | per-mesh cull distance from instance size × 1100, flat loop, frozen matrices | ring residency, frustum, some LOD | Lane D |
| Loading | modulepreload, preload as=fetch, staged yields, precompile one per pipeline with progress, warm-up frame | `renderer.compile` once in sharedFrame; pop-in fixes | Lane D |
| Driving feel | 120 Hz substeps, display-rate agreement test, speed-dependent lock, friction circle | variable dt ≤ 50 ms, constant yaw rate reduced 30 % at speed | **Lane E** |
| Camera follow | smoothing of the entity-relative offset | world-space ease of x,y (`camera.js:86`) | Lane E |
| Touch plumbing | radial dead zone rescale, pointer capture, max-blended sources, reset on blur | street-follow mode shipped 10-29 | Lane E, small items |
| Ground derivation | raster capsules + EDT + open/close → blocks, curbs, sidewalks; routing from the rendered ground; SCC prune | BGT polygons + OSM bands, named ROAD_SPOTS | **Lane F**, spike only |
| Road paint | network-derived quads, dashes in the shader, ≥ 1.5 px widening | photo-evidenced marks as geometry | Lane F |
| Placement predicates | small tested pure functions (curb island, pole spacing, snap-not-across-street) | bollards, trees near route thinned | Lane F / content lanes |
| Traffic, pedestrians | IDM + Bézier lanes, 200 cars, 340 people, dodge the player | none | user decision (issue) |
| Time of day, night windows | 4 presets, interior mapping, clustered distant lights | one fixed sun 215°/40° (LOOK §Light) | user decision (issue) |
| Audio | fully procedural; bicycle ratchet/chain/tyre voice | disabled by product decision | user decision (issue) |
| Water | FFT slope texture, LEAN roughness | matte, user asked for no reflection 10-13 | no |
| Post | SSR, MRT, bloom, grade | none | no (phones) |
| Process | one idea per commit, generator + artefact + test together, perf-as-tests, regex+vm harness | similar, plus TODO/HISTORY | adopt the two test ideas (Lane D, E) |

What not to copy: the constant-yaw 68 km/h bicycle; flat roofs; year-only
materials; WebGPU-only parts (clustered lighting, storage-buffer skinning,
reversed depth, SunLight cascades); SSR and the G-buffer on phones; a global
signal cycle; no CI, no package.json, no TODO.

## 4. The lanes

All opus unless the brief says a step is haiku. Each lane is a GitHub issue
labelled `lane` when spawned, hands back in the `LANE-RULES.md` format, and
is accepted by a strip or a measured number named in its brief. Ports come
from `scripts/worktrees/new.sh`.

| # | Lane | Brief | Depends on | Size | Acceptance |
|---|---|---|---|---|---|
| A | Three owns the frame (revive drop-MapLibre, flag-gated steps) | `lane-three-owns-frame-20261029.md` | — | 3–4 weeks in steps of days | step 1 merged behind `?ownMap=1` within a week; real-iPhone ride before default |
| B | Shader facades for the ordinary ring | `lane-facade-shader-20261029.md` | none to start; lands under the shared frame | 1–2 weeks | strips at 60/150/400 m beside today's, triangles and programs down, measured colours kept |
| C | Compact binary extracts | `lane-binary-extracts-20261029.md` | — | 3–5 days | bytes and decode ms before/after, sentinel pands pinned |
| D | Shadow stand-ins, culling, loading recipe | `lane-shadow-standins-culling-20261029.md` | — | 1 week | shadow draws, ride-perf, time-to-ride before/after |
| E | Driving feel: substeps, lock, camera offset | `lane-driving-feel-20261029.md` | — | 3–5 days | display-rate test green; named junction rides; user rides the strip |
| F | Ground raster spike | `lane-ground-raster-spike-20261029.md` | — | 1 week, spike | side-by-side with the orthophoto at the 13 ROAD_SPOTS; no rollout without the user |

Order: A1 (step 1 of the frame) and E first because they are small and
unblock or de-risk the rest; C and D in parallel (data and renderer lanes,
different files); B after C's footprint stream exists (B reads it); F last and
only as a spike. B, D and F all touch the shared frame and the ground; give
them separate worktrees and have the integrator merge in that order.

## 5. Product questions for the user (issue, label needs-david)

1. **NPC life.** Slop's recipe (IDM car-following on Bézier lane connectors
   pruned to the largest strongly connected component, late committed dodges
   of the player, 340 pedestrians on sidewalk tracks) is well documented and
   portable. In a learning game it costs attention and frame time and adds
   nothing to recall. Trams on their real lines would teach something; cars
   would not. Decision wanted: none / trams and bikes only / full traffic.
2. **Time of day.** LOOK fixes one sun so facades compare across pipelines.
   A dusk or night preset would need slop's interior mapping and clustered
   distant lights (both pure shader maths, portable) and a second set of
   likeness strips. Decision wanted: stay with one sun, or allow a dusk ride.
3. **Audio.** Disabled "without an explicit product decision". The cheapest
   port is the bicycle voice (tyre hiss, freewheel ratchet when coasting,
   chain when pedalling) plus wind sheltered by street enclosure, about 150
   lines and no files. Decision wanted: keep silent, or allow a muted-by-
   default bike voice.
4. **Drop MapLibre pace.** Lane A proposes landing flag-gated steps on main
   weekly instead of the long-lived branch rule from 2026-10-10. Confirm.

## 6. Numbers to carry forward (baseline, 2026-10-29)

- Desktop chase ride: vsync-bound 16.7 ms, 851 draws, 32 programs after the
  water-cut fix, mapRender 2.4 ms.
- iPad main pass at pitch 60: 1.13–1.36 M triangles (#100).
- Ride-start memory, iPhone profile: heap 245 MB, ArrayBuffers 67 MB, GL
  buffers 140 MB; MapLibre workers 37 + 50 + 7 MB.
- Extracts: bag-tiles 18 MB, building-tiles 16 MB, municipal-trees 6.2 MB,
  own-ground cells 29.6 MB gz, roads-v1 14 MB.
- Slop: 441 KB for 37,353 footprints; 123 KB for 70,680 trees; 394 KB for the
  rest of Manhattan; 288 building cell meshes; shadow stand-ins saved 35–50
  draws a frame.
