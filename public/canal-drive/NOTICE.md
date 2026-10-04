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

The chase/cockpit player bicycle defaults to an authored low-poly Dutch
omafiets (dark-green step-through, upright bars) built by
`scripts/build-omafiets-bike.py` for chase readability. Named pivots
`Lenker` / `RadVorn` / `RadHinten` are authored empties at the head tube and
hubs. Runtime file is `omafiets-runtime.glb`. Players can also pick:

- Kin Chen’s “Pink city bicycle” (CC0 via MorfVision / BlenderKit) —
  `pink-city-bicycle-runtime.glb`, rigged by `scripts/rig-pink-city-bike.py`
- Authored Swapfiets Original-alike (double step-through, chrome bars,
  front carrier, blue front tyre) — `swapfiets-runtime.glb`, built by
  `scripts/build-swapfiets-bike.py` (steer / spin). Earlier PatrickGoud
  Sketchfab body was look-only and is no longer shipped.

Bike skin preference: `bikeSkin` in `canalRecall.preferences.v1`.
Optional rear child seat: `bikeBabySeat` (omafiets `BabySeat`; default off).

The chase/cockpit player boat is “Moored Aluminum Boats”, generated with
Meshy AI by the project owner rather than sourced from a third party, so it
carries no upstream author to credit. Anyone redistributing this repository
should confirm Meshy's current generated-asset terms for themselves; they vary
by plan and are not asserted here. The GLB has no materials; runtime paint
makes it a canal sloep (dark green hull, cream seats) rather than bare metal.

The boat was reduced the same way, 2.85 MB to 0.24 MB and then to 0.03 MB at
7,994 triangles; it arrives as raw geometry with no normals, materials or
textures, so normals and a height-painted sloep colour are applied at runtime.

# Transit chase mesh (demo)

**DEMO ONLY — licence not cleared for shipping.** Transit mode currently loads
`gvb-metro-51-runtime.glb`, packed from the mini-amsterdam-3d coursework
mirror of UiGoku’s Sketchfab “Gvb metro 51”. Treat as a temporary stand-in
(metro silhouette, not street tram 2). Replace before any public release.

# Signature landmark models

**PROTOTYPE — the licence question below is open and unresolved.**

The legacy source catalogue includes imported buildings from
3D Warehouse, used under the 3D Warehouse General Model License (https://3dwarehouse.sketchup.com/tos/).

Eight of the original imports were the City of Amsterdam's own survey models, uploaded in a single batch
on 2007-05-08 for Google's Earth 3D-buildings programme, back when Google owned
SketchUp. That origin explains what they contain: each is built on a Google
Earth snapshot, which the export still carries.

- **Westerkerk** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/11e419e09f0c9a7e270fcd68188626b2
- **Stadhuis (City hall)** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/5995fd7a0e7fa47d99c802e874695f6b
- **Oude Kerk (Old Church), retired import** — replaced by an original project mesh; historic source: City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/5ec8bf3fa426e5d622fc8389905f949e
- **National Monument on the Dam** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/80385c387986217491e131c17526634a
- **NEMO** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/a2a1d7c7726cb7e065a54e9dd3ee74f
- **Rijksmuseum** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/a57b8c559152b7851aeb638739e9b807
- **De Beurs van Berlage (Stock Exchange)** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/c5a0708f3e4b36fe622758e070290bc2
- **Palace on the Dam** — City of Amsterdam, Geo en Vastgoedinformatie, https://3dwarehouse.sketchup.com/model/d1ad512d8df5fc6745407e0587dff10e

Four more are community models of landmarks the city never made:

- **Munttoren Amsterdam** — OnO, https://3dwarehouse.sketchup.com/model/289437190bd7efc1c0de3c0357f9a9da
- **Montelbaanstoren, Amsterdam.** — OnO, https://3dwarehouse.sketchup.com/model/917a5cc60a9c5469c0de3c0357f9a9da
- **Heineken Experience, Amsterdam.** — marcinplymouth, https://3dwarehouse.sketchup.com/model/4e77b7d365245b8239a65e5e29a6306
- **Concertgebouw (ALMOST FINISHED)** — Gijs, https://3dwarehouse.sketchup.com/model/702e13dbca79c53796fa299c99288367

The licence permits incorporating a model into a Combined Work carrying
substantial additional content and distributing that work, including
commercially; it does **not** permit aggregating models from the site for
redistribution as an asset library. A `public/canal-drive/models/` directory in
a public repository is arguably the second thing rather than the first. **This
is not settled, and nothing here should be published until it is.** Trimble
takes written requests at 3dwarehouse-tou@sketchup.com.

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
- `default_face_material` — SketchUp's "unpainted", exported near-white — set
  to a mid grey, so it reads as shaded stone rather than as holes punched
  through a roof.
- Spare UV sets and tangents dropped, textures re-encoded as WebP at 512 px,
  geometry quantized and meshopt-compressed.

Each is placed at its own published coordinate, at its surveyed size, unscaled
and unrotated.

# Original low-poly landmark reconstructions

Amsterdam Centraal (Cuypersgebouw), Muziekgebouw / Bimhuis, OLVG West,
OLVG Oost, Van Gogh Museum, Stedelijk Museum, A’DAM Tower, Pontsteiger,
OBA Oosterdok, REM-eiland, Paradiso and Melkweg are original project meshes generated by
the project. Silodam, Embassy of the Free Mind / Huis met de Hoofden,
The Movies, DeLaMar, Magna Plaza, Felix Meritis, De Kleine Komedie, De Balie,
Anne Frank House, Rembrandt House, Moco Museum, Museum Van Loon, Amstelkerk,
He Hua Temple, Haarlemmerpoort, Museum Het Schip, Scheepvaarthuis, Rialto,
Kriterion, De Bijenkorf, Gashouder, Stadsschouwburg, Tuschinski, Pathé City,
Oude Kerk, Nieuwe Kerk, Buiksloterkerk, English Reformed Church, De Papegaai,
De Hallen, Huis Bartolotti, H’ART Museum, Amsterdam Museum, Jewish Museum,
Portuguese Synagogue, Hollandsche Schouwburg, National Holocaust Museum and
Homomonument, ARTIS Micropia/Ledenlokalen, ARTIS entrance and Hortus
greenhouses/orangery, Arcam, Foam, Huis Marseille, Ons’ Lieve Heer op Solder,
Brakke Grond, Frascati, Boom Chicago, Agnietenkapel, LAB111, OCCII, Ketelhuis,
Wereldmuseum Amsterdam, Dutch Resistance Museum, Allard Pierson, Dominicuskerk,
Vredeskerk, Badhuistheater, Cinecenter, Studio/K / Timorplein school, ARTIS
Groote Museum, ARTIS Library, Willet-Holthuysen, Amsterdam Pipe Museum,
Athenaeum/Nieuwscentrum, Scheltema, Haarlemmermeerstation, De Dokwerker,
Begijnhofkapel, Houten Huys, Huis De Pinto, Amsterdam Tulip Museum, OT301,
Filmhuis Cavia and Orgelpark use the
same original modelling workflow in
`scripts/landmarks/build-manual-landmarks.ts`. The live game loads these
flat-colour replacements; the older imported catalogue remains available in
the signature-model demo. No reference photograph pixels or downloaded
model geometry are included. The current Centraal and Oude Kerk GLBs replace their former
3D Warehouse assets.

Hospital footprints and landmark placement coordinates derive from
OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
The hospital height divisions and facade details are approximate reconstructions.
Per-building visual references and provenance are in `signature-landmarks.json`.

# Municipal trees and park landscaping

Tree locations, species, planting years, management types and height classes
come from the [Gemeente Amsterdam tree inventory](https://maps.amsterdam.nl/bomen/)
through its [public GISIB API](https://api.data.amsterdam.nl/v1/docs/datasets/bomen.html).
The publisher describes the licence as “openbaar, tenzij anders aangegeven /
behoudens uitzonderingen”. Retrieval date, API fields and height interpretation
are recorded in `data/extracts/amsterdam/municipal-trees/index.json`.
Stump records are excluded. Crown silhouettes, branch forks, foliage and bark
colours are original approximate models; they are not surveyed crowns.
Species/cultivar references are embedded in `da-costa-block/tree-typology.js`.

The same streamed tiles supplement that inventory with explicit OpenStreetMap
`natural=tree` nodes inside the Amsterdam municipality boundary (relation 47811).
Every supplemental trunk is more than 12 metres from the municipal inventory;
no `tree_row` positions are sampled. OSM node identities, species/genus and
recorded metre heights are preserved, with `osm-n` IDs and `source: osm`.
These records are © OpenStreetMap contributors under
[ODbL](https://www.openstreetmap.org/copyright). Municipal and OSM counts,
licences, deduplication rules and height provenance are recorded separately in
the tile index. OSM trees without a valid recorded height use an authored
9-metre display fallback, not a measured height.

Park boundaries, lawns, woodland, ponds, paths and bench locations derive from
OpenStreetMap contributors under [ODbL](https://www.openstreetmap.org/copyright).
`scripts/build-park-landscape.mjs` rebuilds the mapped park/site overlays and optional Amsterdamse Bos chunk from the
cached source extract. No synthetic ponds, tree positions or paths are added.
