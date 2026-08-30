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
