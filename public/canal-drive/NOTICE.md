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

The chase/cockpit player boat uses “Motor Boat” by gogiart (@agt14032013),
licensed under Creative Commons Attribution 4.0. Source:
https://sketchfab.com/3d-models/motor-boat-b485860039f24a7ab2a513432767890c

Both models ship here in modified form, as these licences require to be stated.
Neither was changed artistically; both were reduced so a browser game can
download and draw them. The bicycle had its rig, its unplayed animation and its
tangents and UVs removed — it carries no textures — and was then welded,
simplified and quantized, 8.57 MB to 2.01 MB. The boat was converted from OBJ,
welded, simplified, its textures resized to 512 px, and quantized, 21.19 MB to
1.82 MB. The unmodified originals remain at the Sketchfab links above.
