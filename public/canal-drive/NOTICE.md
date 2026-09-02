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

The Royal Palace of Amsterdam (Paleis op de Dam) uses "Palace on the Dam" by
the City of Amsterdam, Geo- en Vastgoedinformatie, from 3D Warehouse:
https://3dwarehouse.sketchup.com/model/d1ad512d8df5fc6745407e0587dff10e

It is used under the 3D Warehouse General Model License
(https://3dwarehouse.sketchup.com/tos/). That licence permits incorporating a
model into a Combined Work carrying substantial additional content and
distributing that work, including commercially; it does not permit aggregating
models from the site for redistribution as an asset library. **Anyone forking
this repository should satisfy themselves on that point for their own use**,
because a `models/` directory in a public repository is closer to the second
case than the game around it is. Trimble takes written requests at
3dwarehouse-tou@sketchup.com.

The model ships here in cleaned-up form. It was not changed artistically; the
changes correct an export rather than restyle a building:

- SketchUp construction edges (LINE primitives) removed. They drew as stray
  hairlines across the city and made the model measure 136 m wide when the
  building is 85 m.
- All faces made double-sided, so inward-wound faces stop rendering black.
- All materials set non-metallic. Every one arrived at `metallicFactor 1.0`,
  which is glTF's default when an exporter omits the field rather than anyone's
  choice, and a fully metallic surface with no environment map renders black.
- The two `default_face_material` surfaces — SketchUp's "unpainted", exported
  as near-white, and in this model the insides of the Palace's two internal
  courtyards — darkened to a neutral so they read as shaded interior rather
  than as holes punched through the roof.
- Spare UV sets and tangents dropped, textures re-encoded as WebP at 512 px,
  geometry quantized and meshopt-compressed. 1.72 MB to 0.64 MB.

It is placed at the city's own published coordinate, at its surveyed size,
unscaled and unrotated.
