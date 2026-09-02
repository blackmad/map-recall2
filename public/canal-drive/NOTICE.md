# Amsterdam Canal Recall prototype

This directory is a modified version of **Smokeys and the Bandit** by Alan
Wright (`a1anw2/smokeysandthebandit`), licensed under GNU GPL version 3.
The original `LICENSE` is included in this directory and the unmodified source
history is available at <https://github.com/a1anw2/smokeysandthebandit>.

Modifications for Map Recall include loading the curated Amsterdam waterway
extract, boat-oriented handling and rendering, label-free tiles, removal of
traffic from active play, and waterway-name recall prompts.

Later prototype additions include a synchronized MapLibre/OpenFreeMap vector
basemap, POI-to-POI routes, multiple answer modes, route finding, and selectable
navigation assistance.

Optional tree positions are extracted from OpenStreetMap `natural=tree` nodes
and sampled `natural=tree_row` ways, and cached with the city extract.

Map data is © OpenStreetMap contributors and is available under ODbL. Basemap
tiles are provided by CARTO using OpenStreetMap data.
# Interface icons

The recall prompt uses Route and Waves icons from Lucide, licensed under the
ISC License, and the Bridge icon from Font Awesome Free, licensed under
CC BY 4.0. See https://lucide.dev and https://fontawesome.com.

The chase/cockpit player bicycle uses “Carbon Frame Bike” by Robert Schweier
and prefrontal cortex, licensed under Creative Commons Attribution-ShareAlike
4.0. Source: https://sketchfab.com/3d-models/398999b3360b4e6997a9aae253d6acbd

The chase/cockpit player boat is “Moored Aluminum Boats”, generated with
Meshy AI by the project owner rather than sourced from a third party, so it
carries no upstream author to credit. Anyone redistributing this repository
should confirm Meshy's current generated-asset terms for themselves; they vary
by plan and are not asserted here.

The bicycle ships here in modified form, which its CC BY-SA licence requires to
be stated. It was not changed artistically, only reduced so a browser game can
download and draw it: its rig, its unplayed animation and its tangents and UVs
were removed — it carries no textures — and it was then welded, simplified and
quantized, 8.57 MB to 2.01 MB. The unmodified original remains at the Sketchfab
link above. The boat was reduced the same way, 2.85 MB to 0.24 MB; it arrives as
raw geometry with no normals, materials or textures, so its shading and its
aluminium colour are applied at runtime.

# Signature landmark models

A small curated set of buildings is drawn from real models instead of extruded
OSM footprints. Each is credited here and in `models/signature-landmarks.json`,
and the credit is also shown in the game beside the model.

The Royal Palace of Amsterdam (Paleis op de Dam) uses “Amsterdam Monument Het
Paleis op de Dam 4k A.I.” by Jungle Jim (sketchfab.com/jungle_jim), licensed
under Creative Commons Attribution 4.0. Source:
https://sketchfab.com/3d-models/amsterdam-monument-het-paleis-op-de-dam-4k-ai-d6553e1a6e6f4859a6da4debb5d5a485

It ships here in modified form, which CC BY requires to be stated. It was not
changed artistically, only reduced so a browser game can download and draw it:
two spare UV sets and its tangents were removed, its vertices were welded and
decimated from 499,667 to 59,989 triangles, its three textures were resized to
1024 px and re-encoded as WebP, and its geometry was quantized and
meshopt-compressed — 30.99 MB to 1.08 MB. It was then placed, scaled and
rotated onto its surveyed OpenStreetMap footprint. The unmodified original
remains at the Sketchfab link above.

Note that this model is described by its author as AI-assisted. Its street
frontage is faithful — scaled to the surveyed 80.98 m footprint its cupola
lands at 53.6 m, which agrees with the real building — but its depth is not:
it is 24.5 m deep where the real Palace is around 56 m. See `TODO.md`.
