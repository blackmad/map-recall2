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
quantized, 8.57 MB to 2.01 MB. It has since been reduced again, from 1.92 MB to
0.65 MB: the meshes the game does not animate were lifted to the scene root and
merged, the whole was decimated from 73,921 to 48,235 triangles and 280 draw
calls to 200, and the result compressed with EXT_meshopt_compression, which the
earlier pass had never applied. `Lenker`, `RadVorn` and `RadHinten` are
untouched, because the game steers and rolls them by name. The unmodified
original remains at the Sketchfab link above.

The boat was reduced the same way, 2.85 MB to 0.24 MB and then to 0.03 MB at
7,994 triangles; it arrives as raw geometry with no normals, materials or
textures, so its shading and its aluminium colour are applied at runtime.

# Signature landmark models

**PROTOTYPE — the licence question below is open and unresolved.**

Nine buildings are drawn from real models instead of extruded OSM footprints.
All nine are survey models published by the City of Amsterdam, Geo- en
Vastgoedinformatie, on 3D Warehouse:

- **Westerkerk** — https://3dwarehouse.sketchup.com/model/11e419e09f0c9a7e270fcd68188626b2
- **Stadhuis (City hall)** — https://3dwarehouse.sketchup.com/model/5995fd7a0e7fa47d99c802e874695f6b
- **Oude Kerk (Old Church)** — https://3dwarehouse.sketchup.com/model/5ec8bf3fa426e5d622fc8389905f949e
- **Centraal station** — https://3dwarehouse.sketchup.com/model/6e8629eaefa7ab9f4e5ba763a187284e
- **National Monument on the Dam** — https://3dwarehouse.sketchup.com/model/80385c387986217491e131c17526634a
- **NEMO** — https://3dwarehouse.sketchup.com/model/a2a1d7c7726cb7e065a54e9dd3ee74f
- **Rijksmuseum** — https://3dwarehouse.sketchup.com/model/a57b8c559152b7851aeb638739e9b807
- **De Beurs van Berlage (Stock Exchange)** — https://3dwarehouse.sketchup.com/model/c5a0708f3e4b36fe622758e070290bc2
- **Palace on the Dam** — https://3dwarehouse.sketchup.com/model/d1ad512d8df5fc6745407e0587dff10e

They are used under the 3D Warehouse General Model License
(https://3dwarehouse.sketchup.com/tos/). That licence permits incorporating a
model into a Combined Work carrying substantial additional content and
distributing that work, including commercially; it does **not** permit
aggregating models from the site for redistribution as an asset library. A
`public/canal-drive/models/` directory in a public repository is arguably the
second thing rather than the first. **This is not settled, and nothing here
should be published until it is.** Trimble takes written requests at
3dwarehouse-tou@sketchup.com.

Each model ships cleaned up, not changed artistically; the changes correct an
export rather than restyle a building:

- SketchUp construction edges (LINE primitives) removed. On Centraal these
  spanned 3.3 km and drew as hairlines across the city.
- The Google Earth snapshot each model was traced over, and the terrain patch
  under it, removed. These are why Centraal measured 751 m across and NEMO
  297 m, and they drew as slabs of someone else's satellite imagery pasted over
  the basemap. They are detected by material name and by covering a couple of
  hundred metres with fewer than 64 triangles — the Rijksmuseum's site is
  239 x 201 m with 8 triangles, where its actual roof spends 1,702.
- All faces made double-sided, so inward-wound faces stop rendering black.
- All materials set non-metallic. Every one arrives at `metallicFactor 1.0`,
  glTF's default when an exporter omits the field rather than anyone's choice,
  and a fully metallic surface with no environment map renders black.
- `default_face_material` — SketchUp's "unpainted", exported near-white —
  darkened to a neutral, so the Palace's internal courtyards read as shaded
  interior rather than as holes punched through the roof.
- Spare UV sets and tangents dropped, textures re-encoded as WebP at 512 px,
  geometry quantized and meshopt-compressed.

Each is placed at the city's own published coordinate, at its surveyed size,
unscaled and unrotated.
