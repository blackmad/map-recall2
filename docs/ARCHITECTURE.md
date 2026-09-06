# Architecture

How Canal Recall turns a city into something it can teach, from raw registers to
the buildings you cycle past. Five pipelines, each with its own chapter below.

Each chapter is the document that used to live on its own, kept in the words it
was written in — the reasoning is the expensive part and paraphrasing it loses
exactly what a later session needs. What is new is the order and the connective
tissue, so this can be read top to bottom.

The façade twin — the deepest of these pipelines — has its own file,
[`FACADE_TWIN.md`](FACADE_TWIN.md), because it is large enough to need one.

## Contents

1. [The city extract pipeline](#1-the-city-extract-pipeline)
2. [The geolocated fact pipeline](#2-the-geolocated-fact-pipeline)
3. [Building levels of detail](#3-building-levels-of-detail)
4. [The appearance-aware building renderer](#4-the-appearance-aware-building-renderer)
5. [Building appearance enrichment](#5-building-appearance-enrichment)
6. [Roof enrichment](#6-roof-enrichment)

---

## 1. The city extract pipeline

*Was `public/canal-drive/EXTRACT_PIPELINE.md`.*

How a city becomes something the game can teach, and the rules that keep the
published files describing one city rather than several.

The game never calls a third-party API while you play. Everything it needs is a
versioned extract under `public/data/extracts/<city>/`, built here.

### Running it

```bash
npm run refresh:amsterdam          # downloads Amsterdam from BBBike, rebuilds, publishes
npm run refresh:utrecht            # the same script, different arguments
bash scripts/refresh-city-extract.sh <id> <Name> <lat,lon> <BBBikeName> [local.osm.pbf]
```

Pass a local `.osm.pbf` as the fifth argument to skip the download — useful when
iterating, because the download is the slowest stage and the least interesting.

`refresh-amsterdam-extract.sh` is one `exec` into the general script. Amsterdam
gets no private path; if it did, it would drift.

Everything is built into a temporary directory and copied into
`public/data/extracts/<id>/` **only after every stage succeeds**. A transient
Wikimedia failure must not replace a working city with a half-enriched one.

### The stages

1. **Download and filter.** `osmium tags-filter` reduces the city PBF to the
   tags the game uses, then `osmium export` converts to GeoJSON. The filter list
   lives in `refresh-city-extract.sh`; adding a feature class means adding it
   both there and to `classify()`, or the extractor will look for tags that were
   filtered away.
2. **Extract.** `build-amsterdam-extract.ts` — despite the name, it takes a city
   as arguments — groups ways by name, scores them, and writes the partitions
   (`water`, `streets`, `bridges`, `squares`, `parks`, `landmarks`), the routing
   network, boundaries and orientation POIs.
3. **Appearance and trees.** `build-osm-building-appearance.ts`,
   `build-osm-trees.ts`.
4. **Enrichment.** Wikimedia images, Wikipedia ledes, the city profile, brand
   identities, then curated image overrides. All share one cached fetch
   (`scripts/lib/cached-json-fetch.ts`, cache in `.cache/`), so a re-run is
   nearly free and a transient failure is cheap.
5. **Bridge artifacts.** `build-bridge-crossings`, `build-bridge-railways`,
   `build-bridge-distractors`. **These must run in the same pass as the extract**
   — see "Bridges are a matched pair" below.
6. **Check, then publish.** `check-city-extract.ts` runs against the build
   directory; only then is anything copied into `public/`.

### Rules that are load-bearing

Each of these was learned by breaking it. They are enforced by checks, not by
memory — `npm run check:canal` runs them all.

#### Connectivity is decided on raw geometry

Ways connect when they share an **identical vertex**. Proximity is deliberately
not used: joining ways that pass within ~33 m merged parallel roads and roads on
different levels.

That makes simplification dangerous. Douglas-Peucker deletes exactly the
vertices that carry connectivity — a junction node lying within the tolerance of
the line between its neighbours is dropped, and two ways that genuinely met
there stop sharing a coordinate. Measured on Amsterdam: simplifying before
connectivity destroyed 17,222 of 62,229 junction vertices and split the drivable
network into 5,624 components with 25,646 ways in the largest. Carrying geometry
raw and simplifying at publication with junctions pinned gives **99 components,
35,219 in the largest**.

So: geometry stays raw until the moment it is written, and
`simplifyPreservingJunctions` never drops a shared vertex. Coordinates are
quantised to ~11 cm first, which shrinks the largest file the game fetches and
makes vertex matching robust against float drift.

#### Feature ids come from identity, never from order

`extract_${category}_${grouped.size}` made an id depend on how many features of
*any* category happened to be inserted before it, so adding one classification
renumbered every bridge in the city. Ids are a hash of the grouping key now.

This matters because other files are keyed on them. It does **not** affect
player progress: spaced-repetition review keys are the feature's name plus the
place it was answered, never its extract id.

#### Bridges are a matched pair

`bridges.json` and `bridge-crossings.json` are keyed on bridge id and must be
built in the same run. Publishing `bridges.json` alone once renumbered every id
and orphaned the index — matched bridges fell from 257/300 to 28/300. Nothing
crashed, which is what made it dangerous: the runtime falls back to a synthetic
crossing with no waterway, so 229 bridges silently lost the water beneath them
and the water-before-bridge rule stopped applying city-wide.

`test:bridge-crossings` now asserts that no crossing-index entry names a bridge
that does not exist, and that most bridges resolve to a real crossing.

#### A road is not a bridge

OSM tags the carried road as `name` and the structure as `bridge:name`. The
extractor prefers `bridge:name`, so Zuiderzeeweg and IJburglaan are published as
Schellingwouderbrug, Amsterdamschebrug, Zeeburgerbrug and Enneüs Heermabrug —
four structures over their own waters, rather than one question answered with a
road name.

#### Coverage is pinned by name, not by count

`test:canal-car` names specific streets and junctions. Counts move for
legitimate reasons; a named street disappearing does not. This is what caught
the routing network halving, and it is the reason the driving harness cannot
replace it: **a sparser network scores *higher* in the harness**, because short
routes are easier to drive.

### The Randstad

```bash
npm run refresh:randstad     # all four, each publishing independently
```

BBBike publishes exactly four of the conurbation — Amsterdam, Rotterdam, Den
Haag and Utrecht — and those are what `refresh-randstad.sh` rebuilds. The
smaller Randstad cities (Leiden, Haarlem, Delft, Dordrecht, Almere, Amersfoort)
have no BBBike extract and would need a different source first.

Each city is independent: one failing does not stop the rest, and each publishes
only if its own build and checks pass.

A municipality is not always mapped under the name people call it — The Hague is
`'s-Gravenhage` in OSM — so the boundary lookup matches `name`, `name:nl`,
`name:en`, `official_name` or `alt_name`.

Built so far: **Amsterdam** (35,216 routing ways, 99 components) and **Utrecht**
(17,594 ways, 58 components). Rotterdam and Den Haag are wired up but have not
been run.

### Adding a city

The extractor is city-agnostic: bounds, centre, curation file, boundary-lookup
name and the `cityId` filed into review keys are all arguments, and the curation
file is optional.

What is not yet city-agnostic is the **runtime**. `osm-loader.js` hardcodes
`../data/extracts/amsterdam/${dataset}.json`, so a built city cannot be reached
from the game. See TODO item 11.

### What the checks cost

| command | what it protects |
| --- | --- |
| `npm run check:amsterdam-extract` | coverage counts and enrichment of the published city |
| `npm run test:canal-car` | named streets, junctions and bridge approaches |
| `npm run test:bridge-crossings` | per-crossing identity, and bridges/index alignment |
| `npm run test:bridge-railways` | railway lines are not asked as bridges |
| `npm run test:reachability` | the routing graph reaches what it claims to |
| `npx playwright test tests/e2e/driving-harness.spec.ts` | 120 real drives; drivability, not coverage |


## 2. The geolocated fact pipeline

*Was `public/canal-drive/FACT_PIPELINE.md`.*

### Goal

Compile a small, attributable, offline-first catalog of facts around each supported city. The game should never wait for a third-party fact API while the player is moving.

### Source policy

#### Preferred open sources

- OpenStreetMap: geometry, names, feature classification, and stable links such as `wikidata`, `wikipedia`, and heritage identifiers.
- Wikidata: entity resolution, coordinates, dates, architects, named-after relationships, heritage status, and Commons categories.
- Wikipedia: short contextual extracts and page links, discovered through linked Wikidata items or geographic search.
- Wikimedia Commons: attributable images associated with Wikidata items and categories.
- Gemeente Amsterdam monuments API: municipal and national monument geometry within Amsterdam.
- Adamlink: historical Amsterdam streets, addresses, buildings, names, and linked-data identifiers.
- Rijksdienst voor het Cultureel Erfgoed: national monument metadata and dates.
- Wikivoyage: CC BY-SA itinerary structure and explicitly attributed tour context where useful.

#### Conditional sources

- izi.TRAVEL can supply structured tours and audio-guide stops, but requires an API agreement/key, usage reporting and attribution, and currently limits caching to three days. Treat it as an optional runtime/licensed connector, not part of the permanent bundled extract.

#### Do not ingest without a separate agreement

- Atlas Obscura pages and commercial walking-tour sites. Store an outbound link only when useful; do not copy their descriptions, images, or tour sequences.

### Canonical record

```json
{
  "id": "amsterdam:Q12345",
  "cityId": "amsterdam",
  "name": "Example landmark",
  "aliases": ["Historic name"],
  "location": [52.37, 4.90],
  "geometry": null,
  "osm": [{ "type": "way", "id": 123 }],
  "wikidata": "Q12345",
  "category": "architecture",
  "neighborhoodId": "...",
  "facts": [
    {
      "text": "One self-contained, display-length fact.",
      "kind": "history",
      "sourceUrl": "https://...",
      "sourceName": "...",
      "license": "CC BY-SA 4.0",
      "retrievedAt": "2026-08-29",
      "confidence": 0.95
    }
  ],
  "media": [],
  "prominence": 0.8,
  "triggerRadiusMeters": 75
}
```

Every displayed statement must retain statement-level provenance. Do not merge claims from differently licensed sources into unattributed prose.

### Build stages

#### Implemented first slice

The current pipeline deliberately starts from features already resolved by the
city extract instead of attempting a second entity-resolution system:

1. `npm run facts:articles` caches complete English or Dutch Wikipedia articles
   for landmarks, bridges, squares, parks, streets and waterways. The cache is
   local and ignored.
2. `npm run facts:build` selects useful article sections and asks local Ollama
   to write short English summaries. Dutch source sentences are first
   translated one-to-one by local `trn --quality high`, with place names held
   out of the translator and the exact Dutch/English pair cached. The writer
   cites numbered English source sentences; code retrieves the aligned exact
   Wikipedia sentences, and a separate
   temperature-zero local pass must confirm that the evidence entails every
   claim. Deterministic gates separately reject altered numbers, stale claims,
   lede restatements, fragments, markup and near-duplicates. It writes only to the ignored
   `public/data/extracts/<city>/staging/` directory. Dutch facts retain the
   exact Dutch evidence, the local `trn` translation, and translator version
   alongside writer and verifier provenance before human review.
3. A person reviews `facts-review.md` and records feature-level approval and
   struck sentences in `scripts/facts-review.json`. Reviews are tied to the
   generator version and therefore fail closed after prompt or gate changes.
4. `npm run facts:publish -- --dry-run` reports exactly what is eligible.
   Running it without `--dry-run` is the only path that writes the shipped
   `facts.json`.
5. The runtime loads that optional file, rotates unseen facts before repeats,
   varies their kinds, and persists the rotation locally. A missing, malformed,
   or wholly unreviewed catalog leaves the existing Wikipedia lede unchanged.

Regenerate the four Randstad staging catalogs after caching their articles:

```sh
for city in amsterdam rotterdam den-haag utrecht; do
  npm run facts:articles -- --directory=public/data/extracts/$city
  npm run facts:build -- --directory=public/data/extracts/$city --city=$city
done
```

The writer, translator and verifier caches are content-addressed, shared across
reruns, and ignored by Git. Publication remains a separate per-city review
operation: Amsterdam uses `scripts/facts-review.json`; the other cities use
`scripts/facts-review-<city>.json` by default.

Every build also writes `staging/fact-rejections.json` and
`staging/fact-rejections.md`. They retain the complete rejected proposal,
rejection code, verifier explanation, feature identity, section, source URL,
original evidence and local translation. Console samples are only a summary;
the staging logs are the audit record used to improve prompts and gates.

Open `/canal-drive/trivia-review.html` while the development server is running
for the visual Trivia Lab. It keeps automatically grounded candidates,
rejections, and human-published facts in separate views, and exposes original
evidence, local Dutch translations, verifier explanations, provenance, search,
and filters. During a build, the generator checkpoints the accepted and
rejected JSON plus `staging/fact-progress.json` every ten attempted features;
use the lab's Refresh button to load a newer checkpoint without interrupting
reading. “Passed gates” always means awaiting human review—not published.

Ollama remains the offline default. For faster bulk regeneration, the same
prompts and fail-closed gates can use OpenRouter without changing catalog
semantics:

```sh
FACT_ENV_FILE=/absolute/path/to/private/.env.local \
  npm run facts:build -- --provider=openrouter \
  --model=qwen/qwen3.5-flash-02-23 \
  --directory=public/data/extracts/amsterdam --city=amsterdam
```

The environment file must define `OPENROUTER_API_KEY`; it is read at runtime
and is never copied into the cache or generated facts. Facts record the exact
provider/model used, so switching providers invalidates review and cache keys.

Every published sentence retains its supporting exact source quotation,
article URL, section, retrieval date, licence, writer and verifier model.
`npm run test:facts` pins the editorial, review and runtime selection rules.
The older first reviewed catalog contains 19 quotations for 9 Amsterdam
features; regenerated summaries remain staged until they receive fresh review.

Names remain native map identities. When Wikipedia explicitly explains a
name, the writer may add its English meaning only as a gloss alongside the
native form—`Magere Brug (“Skinny Bridge”)`—never as a replacement heading.

#### Longer-term catalog

1. **Seed:** load the city boundary plus OSM landmarks, monuments, bridges, squares, museums, historic objects, and buildings with knowledge identifiers.
2. **Authority ingest:** add Amsterdam monument records, Adamlink entities, and national heritage records.
3. **Entity resolution:** merge first by Wikidata/RCE/Amsterdam identifiers, then OSM identity, then conservative name-and-distance matching. Keep ambiguous candidates separate for review.
4. **Knowledge enrichment:** batch Wikidata claims; obtain Wikipedia extracts and Commons media only for surviving canonical entities.
5. **Tour enrichment:** extract open Wikivoyage itinerary stops and ordering. Never let tour sequence override geographic identity.
6. **Fact generation:** transform structured claims into short templates; optionally summarize open extracts, while preserving the source and license of every resulting statement.
7. **Quality scoring:** combine source authority, identifier certainty, fact novelty, geographic precision, route visibility, and city significance.
8. **Deduplication:** detect repeated dates, people, and near-identical facts across nearby entities. Prefer the most authoritative source.
9. **Editorial checks:** reject unsafe, promotional, temporally fragile, overly long, or location-ambiguous facts. Maintain a small curation override file.
10. **Export:** write versioned, deterministic city JSON plus a manifest containing source versions, licenses, timestamps, and attribution text.

### Runtime behavior

- Build a spatial index over fact locations and geometries.
- Trigger only while the vehicle is moving slowly enough to read, or queue the fact until after a turn/quiz.
- Prefer landmarks visible on the current side of travel and within roughly 40–100 metres.
- Apply a cooldown and never show two facts simultaneously.
- Show a landmark at most once per route; allow a “repeat learned facts” preference later.
- Prioritize unseen entities, then facts relevant to the current neighborhood or destination.
- Keep the compact popup to one sentence; put images, longer context, source, and attribution in the collected postcard/detail view.
- Suppress all fact popups independently from the master game-y toggle: facts are a learning layer, not an arcade mechanic.

### Longer-term scripts

- `scripts/facts/seed-city.ts`
- `scripts/facts/ingest-amsterdam-heritage.ts`
- `scripts/facts/enrich-wikimedia.ts`
- `scripts/facts/resolve-entities.ts`
- `scripts/facts/build-facts.ts`
- `scripts/facts/audit-licenses.ts`
- `scripts/facts/validate-facts.ts`

The implemented first slice uses `public/data/extracts/amsterdam/landmarks.json`
and its sibling collections as the seed. The broader multi-source catalog above
remains future work; it should extend the same staged, reviewed publication
boundary rather than bypass it.


## 3. Building levels of detail

*Was `public/canal-drive/LOD.md`.*

### Goal

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

### What the levels mean

#### LoD1: complete measured massing

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

#### LoD2.2: reconstructed building surfaces

3DBAG LoD2.2 reconstructs semantic wall and roof surfaces from BAG and AHN.
Compared with LoD1 it adds pitched and stepped roof planes, ridges, multiple
building parts and much better silhouettes. It also provides reconstruction
quality metadata that can determine whether a building is safe to promote.

LoD2.2 is still not a handcrafted architectural model. It generally has no
window geometry, doors, sculptures, façade ornament or authored textures. Its
automated interpretation can also lose a structural distinction already mapped
in OSM.

#### Signature model: curated authored detail

A signature model is a positioned GLB/glTF asset for a small number of
destinations such as Paleis op de Dam, Rijksmuseum, Amsterdam Centraal,
Westerkerk or NEMO. It can carry recognisable façade detail and materials that
neither an extrusion nor an aerial reconstruction contains.

Signature models are the highest visual tier, but never the city foundation.
Each needs an attribution record, geographic transform, performance LODs,
stable building aliases, and the same picking/highlight behaviour as every
other building.

### The source rule: preserve manual OSM at every level

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

#### Per-building precedence

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

### One owner per building

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

### Appearance is separate from geometry

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

### Current state on `main`

#### OSM/OpenFreeMap fallback — live

The ordinary `building-3d` layer supplies broad city coverage from OpenFreeMap
building data. It preserves citywide OSM `render_min_height` and building-part
massing where the basemap contains them, but many heights are tagged estimates
or generic fallbacks rather than AHN measurements.

#### OSM appearance overlay — live but partial

`buildings-colored.geojson` contains 10,578 appearance-backed OSM buildings.
The renderer draws separate wall extrusions and artificial flat roof caps;
5,778 buildings currently have a sampled aerial roof colour. This improves
colour for part of the city but is not a complete geometry source.

The file is filtered by appearance. It must never be used as if it were the
complete set of manually mapped OSM buildings or parts.

#### Hosted 3DBAG LoD2.2 — live and optional

“Detailed 3D” streams the pinned 3DBAG v2025.09.03 Cesium 3D Tiles set through
the shared MapLibre/Three.js context. It renders real roof geometry and can
highlight an individual mesh feature. When enabled it currently hides the
basemap and coloured OSM building layers, so the best geometry becomes uniform
and loses measured appearance.

The hosted tiles expose BAG IDs through structural metadata. A Rijksmuseum-area
probe found a unique `NL.IMBAG.Pand.*` identity for all 667 sampled features,
so runtime identity joins are feasible. Production should still prefer pinned,
owned assets so an upstream republish cannot silently change the game.

#### Signature models — not started

No landmark GLB is integrated. `feat/signature-landmarks` currently has no
commits. The only shipped GLBs are player vehicles. A downloadable Sketchfab
Paleis op de Dam model under CC BY is the proposed first proof.

### Complete LoD1 branch status

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

#### Blocker 1: incomplete manual OSM input

The resolver reads `buildings-colored.geojson`, which contains only buildings
with appearance data. Manual OSM parts without colour tags never reach the
decision. Magna Plaza has no appearance-tagged feature nearby and collapses
into 48 plain BAG boxes even though the live basemap contains a stepped manual
composition.

Fix: build a complete OSM building/part input independent of appearance. Join
appearance afterward. Add representative regression locations—Magna Plaza,
the Waag, a canal-house row, a raised part and a courtyard—to prove manual
topology survives regardless of colour coverage.

#### Blocker 2: towers flattened to podium height

LoD1 uses 3DBAG `b3_h_dak_70p`, the correct ordinary LoD1.2 extrusion height.
For a slim tower on a broad podium, however, most roof points belong to the
podium. In the staged city 201 BAG buildings render more than 10 m below their
AHN ridge, 66 by more than 20 m, and 21 by more than 40 m.

Fix: detect multi-height/tower candidates using the roof percentile, maximum,
ridge, footprint, OSM parts and LoD2.2 surfaces. Prefer a resolved multi-part
composition. Where only one extrusion is possible, use an explicit reviewed
rule rather than silently flattening the skyline.

### Delivery plan

#### Phase 1 — make LoD1 a strict improvement

1. Ingest every OSM building and `building:part`, not the colour-filtered set.
2. Separate geometry resolution from appearance resolution.
3. Add tower/podium detection and a multi-part or reviewed height decision.
4. Regenerate the city and run the comparison routes.
5. Require no loss at named manual-geometry fixtures.
6. Publish the BAG-keyed z14 city only after the existing basemap layer can be
   removed without a visual or interaction regression.

This is the next shippable milestone.

#### Phase 2 — reconcile LoD2.2 with manual OSM

1. Pin a small representative LoD2.2 sample containing landmarks, terraces,
   towers, flat roofs and courtyards.
2. Compare semantic 3DBAG parts with complete OSM part graphs per BAG building.
3. Define deterministic preservation signals: vertical stacking, deliberate
   voids, part count, boundary agreement and measured reconstruction error.
4. Emit one resolved detailed asset with source decisions in its manifest.
5. Replace fallbacks building-by-building after successful tile load.
6. Carry measured roof/wall appearance into semantic surfaces.

#### Phase 3 — signature landmark proof

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

#### Phase 4 — widen detailed coverage only when it pays

Tile resolved LoD2.2 assets around the camera with bounded concurrency,
eviction hysteresis and a normal LoD1 fallback. Expand first by visual and route
value, not by raw building count. A detailed tier that cannot meet mobile byte,
decode and frame-time budgets stops at signature landmarks.

### Acceptance gates

#### Geometry and coverage

- Every drivable-area building has exactly one visible representation.
- Complete manual OSM geometry is consulted before every ownership decision.
- Named complex fixtures retain towers, stacking, passages and courtyards.
- No duplicated walls, roofs, z-fighting or tile-edge erasure.
- Missing or rejected measurements are labeled as fallback, never invented.

#### Interaction

- BAG, OSM and landmark aliases resolve consistently across all tiers.
- Mesh and footprint clicks select the same feature.
- Highlighting, visibility toggles and camera transitions survive promotion and
  fallback.
- Failed, slow or evicted detail leaves a visible clickable LoD1 building.

#### Performance

- Measure compressed transfer, parse/decode time, resident tile bytes, GPU
  memory and draw calls on desktop and the mobile test target.
- Loading is spatially bounded and never forces continuous repaint while idle.
- The complete fallback remains useful before any detailed tile arrives.

#### Reproducibility and provenance

- Pin BAG/3DBAG/OSM/imagery versions and content hashes.
- Record the winning geometry source and rejected alternatives per building.
- Keep model creator, source URL, license and modification history in the asset
  manifest and visible attribution surface.
- Regeneration is deterministic and review overrides survive geometry releases
  by keying on BAG identity and surface kind, not unstable surface indices.

### Immediate next actions

1. Rebase `feat/lod1-building-city` onto current `main` without publishing its
   staged data.
2. Build the complete OSM building/part input and fix the Magna Plaza class of
   regression.
3. Implement and test the tower/podium resolver.
4. Rebuild the comparison city and decide whether LoD1 is now a strict visual
   improvement.
5. In parallel only after the foundation is stable, acquire and inventory the
   Paleis op de Dam GLB for the signature-model proof.


## 4. The appearance-aware building renderer

*Was `public/canal-drive/BUILDING_RENDERER_DESIGN.md`.*

### Status

Proposed architecture. This document replaces the assumption that Amsterdam's
production building meshes should be generated primarily by OSM2World. For the
Netherlands, BAG identity plus 3DBAG LoD2.2 geometry is the stronger canonical
foundation. OSM remains an important semantic source and OSM2World remains a
useful reference/fallback for cities without comparable government geometry.

The companion [`BUILDING_ENRICHMENT.md`](BUILDING_ENRICHMENT.md) describes how
roof and façade observations are obtained. This document describes how those
observations become a coherent, performant city renderer.

[`LOD.md`](LOD.md) is the operational fidelity plan and current implementation
status. It supersedes any reading of this design that would treat automated
3DBAG geometry as categorically higher quality than complete manual OSM
`building:part` topology; all sources are resolved per building before a tier
is selected.

### Decision

Converge on **one building representation per building, and one identity for
it**: BAG `pand_id`, carrying appearance resolved from OSM tags, measured PDOK
imagery and review, rendered as a complete LoD1 extrusion city that detailed
geometry replaces building-by-building where it exists.

The end state is an offline compiler joining BAG/3DBAG geometry, OSM semantics
and measured appearance into independently cacheable 3D tiles, rendered through
one MapLibre custom 3D layer. The compiler is the *last* step, not the first:
the complete LoD1 city with measured colours is most of the visible win, needs
no custom renderer, and is also the fallback the detailed path requires.

Do not continue with the current arrangement of three overlapping geometries:

1. OpenFreeMap's complete but uniformly styled building extrusion;
2. a partial `buildings-colored.geojson` wall extrusion and artificial roof
   slab; and
3. uniformly coloured hosted 3DBAG meshes that hide both other layers when
   enabled.

Only one representation may own a building at a time. A detailed tile replaces
its fallback footprints after it has loaded successfully; failed, absent or
evicted tiles reveal the fallback again.

### Why the city is gray today

The appearance extract is not a complete building dataset. It contains 10,578
OSM buildings that have at least one relevant appearance tag. Of those, 5,778
currently have an aerial roof-colour measurement. Buildings without appearance
tags remain solely in OpenFreeMap's neutral basemap.

The optional detailed mode streams 3DBAG LoD2.2 3D Tiles, but those hosted tiles
use uniform materials. `_syncDetailedBuildingLayers` hides `building-3d`,
`osm-colored-buildings` and `osm-colored-building-roofs` as soon as the detailed
tiles are ready. Consequently the best geometry path discards all locally
measured appearance, while the appearance path uses the least capable geometry.

The replacement makes geometry and appearance one asset instead of two
competing layers.

**The dominant cause is coverage, not fidelity.** The appearance extract
describes 10,578 buildings and 5,778 of those carry a measurement, against a
municipality holding BAG panden in the low hundreds of thousands — count it
exactly in Phase 0b, because the ratio is what justifies the ordering below.
Even a perfect mesh pipeline applied to today's input would leave most of the
city neutral. So completeness is worth more than per-surface realism, it is far
cheaper, and the migration plan buys it first.

### Goals

- Complete Amsterdam building coverage with stable, authoritative identity.
- Real LoD2.2 roof planes, slopes, ridges and stepped building parts.
- Separate semantic wall, roof and ground-facing surfaces.
- Per-surface measured, tagged, inferred or fallback appearance with explicit
  provenance and confidence.
- Properly scaled reusable material textures rather than photographic imagery
  pasted onto buildings.
- A single depth-correct MapLibre custom layer with reliable fallback.
- Building/landmark picking and highlighting that behave identically across
  detailed and fallback representations.
- Spatial streaming, deterministic builds and bounded mobile costs.
- A pipeline that can later support Utrecht and non-Dutch cities without
  pretending that Amsterdam-specific government data is globally available.

### Non-goals

- Photorealistic digital twins or exact window-by-window reconstruction.
- Projecting panorama photographs directly onto meshes.
- Inventing façade observations from nadir imagery.
- Downloading the entire historic panorama image archive.
- Replacing MapLibre, the road/water basemap, labels or game coordinate system.
- Shipping raw PDOK or panorama imagery to players.
- Requiring detailed geometry for gameplay correctness.

### Source hierarchy

#### Identity and footprint

**BAG `pand_id` is the canonical Dutch building identity.** It is stable across
the government geometry and is the key used by the compiled appearance table.
Retain OSM way/relation IDs as aliases for game landmarks, tags and editing
provenance. Store the spatial join method and confidence because one BAG object
may match multiple OSM building parts, and one OSM outline may cover multiple
BAG objects.

#### Geometry

Use 3DBAG LoD2.2 semantic geometry where reconstruction quality passes. It has
actual roof planes derived from AHN, and separates roof and wall surfaces. Use a
simple LoD1.2/1.3 extrusion for missing or rejected LoD2.2 buildings. Do not
reconstruct sloped roofs from the 2D projection when the 3D semantic surface is
available.

#### Appearance

Resolve every surface through a common precedence function:

1. explicit reviewed override;
2. explicit valid OSM colour/material tag;
3. direct government-image observation;
4. high-confidence reviewed/model classification;
5. material/age/use prior;
6. controlled neutral fallback.

An observation and the chosen rendering value are separate records. A newer
observation does not destroy an OSM tag, and changing precedence does not
require rerunning image processing.

**Reviewed overrides key on the building and the surface *kind*, not on a
`surfaceId`.** Human review is the most expensive input in this pipeline, and
`surfaceId` is only stable within one 3DBAG release — plane reconstruction
changes between vintages, so surface-keyed overrides would be silently orphaned
by a routine source upgrade. "The roof of `bag:X` is zinc" survives that;
"surface 7 of `bag:X` is zinc" does not. Finer-grained overrides are allowed
where a building genuinely needs them, but they must record the geometry
version they were made against and be re-reviewed, not carried forward blindly,
when that version changes.

#### Mixed fidelity is the normal state, not a transitional one

The city will always render at several fidelities at once, and that is fine as
long as one rule holds: **fidelity varies per building; ownership never does.**
Two representations of one building is the bug. Two neighbours at different
fidelity is the design.

Geometry is chosen per building from a ladder, best available wins, and the
choice is recorded:

1. 3DBAG LoD2.2 semantic mesh, where reconstruction exists and passes quality;
2. 3DBAG LoD1.2/1.3 extrusion, for panden without an accepted LoD2.2;
3. OSM footprint with an OSM height, for structures BAG does not hold at all —
   canopies, ruins, some building parts;
4. OSM footprint with an *estimated* height, which is where nearly the whole
   city sits today: `build-osm-building-appearance.ts` takes the `height` tag,
   else `levels * 3`, else a flat 9 m.

That last tier is worth naming plainly, because it changes what Phase 1 is
worth. A large part of the current skyline is not measured but guessed, and
replacing it with AHN-derived 3DBAG heights is a fidelity upgrade in its own
right — independent of colour, and visible from every camera angle.

Appearance is mixed too, and deliberately: the precedence function above will
resolve one roof from a measurement and its neighbour from an age prior. Every
surface records which tier it got, so a screenshot can always be traced back to
whether the game measured something or guessed it.

##### Two rules that keep the seams from showing

**Promote terraced rows as a unit.** Amsterdam's canal houses share party walls.
A LoD2.2 house standing next to a LoD1 neighbour will show a step or a gap along
the shared wall, because the mesh's eave height and the extrusion's flat height
will not agree. Detailed geometry must therefore be selected by connected
building group, not by individual pand — a whole row is promoted or none of it
is. This is the strongest constraint the Dutch building typology puts on tile
design, and it is easier to honour in the compiler than to repair in the shader.

**Match colour across the seam before matching geometry.** A LoD1 neighbour with
the same measured roof colour reads as part of the row; the same neighbour in
neutral gray reads as missing. Colour continuity does more for coherence than
geometric continuity does, which is another reason complete appearance coverage
comes before mesh fidelity.

#### Geometry outside the Netherlands

Use OSM building parts and OSM2World or another pinned procedural converter as
the fallback compiler. It must emit the same runtime tile contract, even if its
geometry quality and identity source differ. The runtime must not contain a
separate renderer for each country.

### Canonical data model

The compiler consumes versioned source snapshots and produces a compact
normalized record before mesh generation. Field names below are illustrative;
the implementation should define and validate a versioned TypeScript schema.

```ts
type BuildingAppearance = {
  schemaVersion: 1;
  buildingId: string;             // `bag:<pand_id>` in the Netherlands
  aliases: {
    osmIds: string[];
    bagId?: string;
    landmarkIds: string[];
  };
  geometry: {
    source: '3dbag-lod22' | '3dbag-lod13' | 'osm-procedural';
    sourceVersion: string;
    reconstructionQuality?: number;
  };
  surfaces: Array<{
    surfaceId: string;             // stable within geometry source/version
    kind: 'roof' | 'wall' | 'ground' | 'closure';
    areaM2: number;
    slopeDegrees?: number;
    azimuthDegrees?: number;
    appearance: {
      materialClass: MaterialClass;
      colour: `#${string}`;
      textureId: string;
      source: 'reviewed' | 'osm' | 'aerial' | 'panorama' | 'model' | 'prior' | 'fallback';
      confidence: number;
      observedAt?: string;
      sourceProduct?: string;
      modelVersion?: string;
    };
  }>;
};
```

The renderer does not need this verbose object. The compiler packs the resolved
values into material indices and feature metadata; the full record remains a
build artifact for audits and future regeneration.

### Material system

**Build this only after flat colour has been shown to be insufficient.** The
game's camera is a chase camera at street level moving at cycling speed. Brick
course scale is legible for perhaps 10–30 m and invisible past that, while
silhouette, height and roof colour carry recognition at every distance — and the
product principle is that geographic learning outranks spectacle. So Phase 3's
first output is the same block rendered twice, quantized flat colour against
textured material, judged on a real driving route. The taxonomy and atlas below
are the plan *if* that comparison justifies them; a negative result is a good
result and saves the whole subsystem.

Classify semantic materials first, then select a render texture. A model must
not predict an OSM Texture Library filename directly.

Initial wall classes:

- red, brown and yellow brick;
- dressed/rough stone;
- plaster/stucco;
- exposed/precast concrete;
- glass curtain wall;
- metal cladding;
- wood;
- ceramic/tile cladding;
- mixed, other and unknown.

Initial roof classes:

- clay tile;
- dark tile/slate;
- bitumen/tar paper;
- zinc/metal sheet;
- gravel;
- concrete;
- glass;
- green/vegetated;
- solar-dominant;
- mixed and unknown.

Each texture asset has a manifest entry containing ID, semantic class, author,
source URL, license, attribution, real-world width/height, colourization rules,
normal/roughness availability and checksum. Public-domain or compatible assets
from the OSM Texture Library may seed the set, but licensing is checked per
asset. Prefer a small curated atlas over hundreds of visually redundant files.

Colour and texture are orthogonal. Use a mostly luminance/roughness texture and
tint it with a quantized measured colour where appropriate. Material-specific
textures such as multicoloured brick may use bounded tinting rather than a full
multiply that destroys their natural palette.

Texture coordinates are generated in metres from each surface's local plane.
Adjacent coplanar surfaces should share a stable origin when possible so brick
courses do not restart at every triangle. Roof orientation follows the roof
plane rather than world XY. Mipmaps, anisotropy and distance-specific material
variants must prevent shimmer during driving.

### Colour normalization

Raw aerial sampling currently produces 4,769 distinct roof colours for 10,578
features. That is measurement noise, not useful visual diversity. Normalize in
a perceptual colour space and quantize within each material family. Preserve
the raw observation in the audit record, but compile a controlled renderer
colour.

Quantization must not collapse meaningful classes such as oxidized copper,
terracotta tile, zinc, black bitumen and green roofs. Establish the palette
against a manually reviewed stratified set rather than choosing a fixed number
of global k-means clusters blindly.

### Offline compiler

The compiler is deterministic and operates only on pinned source versions.

```text
BAG snapshot ─────────────┐
3DBAG LoD2.2 ─────────────┼─ identity/spatial join ─ semantic surfaces
OSM snapshot ─────────────┤                              │
PDOK observations ────────┤                              ├─ appearance resolver
panorama classifications ─┤                              │
reviewed overrides ───────┘                              ↓
                                             mesh + material assignment
                                                        ↓
                                           tiled GLB / 3D Tiles + manifest
```

#### Build stages

1. Validate source versions, licenses and checksums.
2. Clip inputs to the city boundary plus a small streaming halo.
3. Build BAG↔OSM aliases and produce ambiguous/unmatched reports.
4. Validate 3DBAG geometry and select LoD2.2 or fallback per building.
5. Join roof observations to roof planes and façade observations to visible
   wall planes. Never broadcast one crop to every side of a building.
6. Resolve appearance per semantic surface and record why it won.
7. Generate metre-scaled UVs, normals, tangents and material indices.
8. Partition into a stable spatial grid; clip or assign large buildings without
   duplicating selectable identity.
9. Generate LODs and compress geometry/textures.
10. Emit tiles, a root manifest, a compact feature lookup and audit reports.
11. Run geometry, coverage, attribution, byte-budget and visual checks before
    publishing a versioned asset directory.

#### Output manifest

The root manifest records:

- schema and compiler versions;
- city and bounds;
- BAG, 3DBAG, OSM, PDOK and panorama source versions;
- attribution/license entries;
- tile URL, bounds, content hash, byte size and LOD statistics;
- feature lookup version;
- total buildings and coverage by geometry/appearance source;
- rejected and fallback counts.

Never overwrite an existing version in place. A release switches one small
city manifest after all tiles have uploaded successfully.

### Where the compiler runs

It is **not** a stage of `refresh-city-extract.sh`. That script builds
everything into a temporary directory and publishes only after every stage
succeeds, which is right for a pipeline measured in minutes and wrong for one
that compiles, LODs and compresses ~200,000 buildings. Coupling them would make
a routine street refresh wait on a texture-compression run, and make a mesh
failure block a bridge fix.

The building compiler is a separate versioned asset pipeline, run deliberately,
keyed on pinned source vintages, publishing into its own versioned directory
that a small manifest switch points at. It shares the extract pipeline's rules —
raw geometry until publication, staging then publish, never overwrite a version
in place — and consumes the extract's outputs, but has its own cadence. See
[`EXTRACT_PIPELINE.md`](EXTRACT_PIPELINE.md) for the rules it inherits.

Cache aggressively at every stage. A full rebuild should be measured and stated
in the manifest; if it cannot be resumed after a failure, it is not yet a build
system.

### Runtime architecture

#### One custom layer

`AppearanceBuildingLayer` owns detailed building rendering, streaming, picking
and highlighting. It shares MapLibre's WebGL context and the existing shared
Three.js runtime. It must not instantiate another canvas or map.

Responsibilities:

- load the city manifest;
- select tiles from camera position/frustum and target screen-space error;
- limit network and decoder concurrency;
- retain nearby tiles with hysteresis to prevent turn-by-turn churn;
- manage GPU disposal and a strict memory budget;
- render depth-correctly against MapLibre terrain/roads/water and game meshes;
- expose `pick(screenPoint)` and `setActiveBuilding(buildingId)`;
- report tile ownership so fallback footprints can be hidden safely;
- restore state after WebGL context loss.

The layer does not know about roof sampling, panorama APIs or model confidence
logic. Those are compiler concerns.

#### Fallback ownership

Fallback is our own complete LoD1 extrusion coverage, not a second permanent
visual layer and not the basemap's. Ownership moves per building, driven by tile
state:

```text
manifest unavailable       → fallback visible
tile requested/loading     → fallback visible
tile decoded and committed → detailed tile visible, its buildings hidden in the
                             fallback source by `buildingId`
tile failed                → fallback remains visible
tile evicted               → fallback restored before detailed tile removal
```

MapLibre cannot hide arbitrary basemap features by BAG ID, because
OpenFreeMap's `building-3d` source does not carry that identity. There are two
ways out, and only one of them works.

A coverage mask — a polygon over each loaded tile's bounds, drawn to obscure
basemap buildings — was considered and is **rejected**. It has to be clipped
away from roads, water and labels to avoid erasing the navigation corridor,
which means reconstructing the basemap's own geometry inside a mask; and being
flat, it cannot hide a tall extrusion leaning in from a neighbouring tile. It
costs about as much as the correct answer and does not work.

So the fallback is ours from the start: **publish a complete BAG-keyed LoD1
building source on the same spatial tiles as the detailed geometry, and remove
`building-3d` from the style.** Fallback and detailed geometry then share
identity, heights and tile boundaries, so replacement is exact and reversible
per building rather than per screen region. This is the intended end state, and
making it the *first* deliverable is what removes the mask question entirely.

#### Picking and highlights

Every rendered primitive carries a compact feature ID resolving to
`buildingId`, aliases and optional landmark IDs. Raycasting a detailed mesh and
querying a fallback extrusion return the same `BuildingHit` contract.

Highlighting must operate at feature granularity without cloning a material per
building. Prefer a GPU lookup texture or feature-state buffer keyed by compact
feature index. The current shader-clone approach is acceptable for a spike but
not for thousands of selectable textured buildings.

### Panorama strategy

**Optional, and last.** Façade appearance is the most expensive and least
certain input here: it needs an imagery licence review, a spatial join to
visible wall planes, a classifier and human review, to answer a question whose
answer in central Amsterdam is "brick" with high prior probability. A BAG
construction-year and use prior gets most of that for free with no licensing
exposure, and belongs in Phase 0b as an `inferred` value. Do not start the
panorama pipeline until flat/textured comparison has shown that wall material
changes what a player recognises.

When it is started: do not mirror every historic image. Download the metadata index, spatially join
camera positions to visible façade planes, then select a small number of useful
views. Deduplicate source panoramas before downloading: one 4K panorama can
produce crops for many nearby buildings.

Keep source panoramas and derived crops in ignored local/object-storage caches.
The published renderer contains only semantic material/colour predictions,
confidence/provenance and curated reusable textures. Human review overrides
model proposals, and `not-visible`/`uncertain` are valid outcomes.

### Performance budgets

Set final budgets from measurements on the project's lowest supported phone.
Initial gates for the Rijksmuseum and one residential-block pilots:

- no additional per-frame network requests after nearby tiles settle;
- at most four concurrent tile downloads and two decode jobs;
- no more than 50 MB detailed-building GPU memory inside the active radius on
  the mobile test target;
- median custom-layer CPU update below 2 ms at the standard chase camera;
- no sustained frame-rate loss greater than 10% versus fallback extrusions,
  measured as frame-time delta over a fixed driving route on the mobile target;
- no single ordinary spatial tile above 2 MB compressed; exceptional landmark
  tiles must be identified and independently cacheable;
- visible fallback within the same frame after tile failure or context loss.

GPU cost is deliberately expressed only as that frame-time delta. A separate
"GPU contribution under N ms" gate needs `EXT_disjoint_timer_query_webgl2`,
which is missing or clamped on much of the mobile browser matrix; a gate that
cannot be measured on the device it protects is worse than the one gate that
can.

One existing defect belongs in the same budget: `detailed-buildings-source.js`
calls `map.triggerRepaint()` unconditionally at the end of every `render`, which
pins the map at continuous repaint whenever detailed buildings are enabled, idle
or not. The custom layer must request repaint only while tiles are loading,
animating or the camera is moving.

These are starting constraints, not promises. Record device, viewport, route,
camera and browser with every benchmark.

### Validation and acceptance

#### Data checks

- Every published Dutch feature has one canonical BAG ID.
- No duplicate surface ownership or duplicate building geometry within a LOD.
- No connected building group is split across geometry sources: every pand
  sharing a party wall with a promoted building is promoted with it.
- Geometry is valid and semantic roof/wall counts are plausible.
- Every material/texture has complete source and license metadata.
- Every non-fallback appearance has source, confidence and observation/model
  version.
- Coverage totals reconcile from source input through published tiles, with
  BAG-only panden and OSM-only structures (canopies, ruins, unmatched parts)
  counted explicitly rather than folded into a single total.
- A failed join cannot silently transfer one building's appearance to a
  neighbour.
- **No building identity reaches a spaced-repetition review key.** Review keys
  are the feature's name plus the place it was answered, deliberately, so that
  extract regeneration cannot churn player progress. `buildingId` is a rendering
  and picking key only; a 3DBAG vintage bump must be invisible to recall state.
- Every source whose licence requires it is named in the map's visible
  attribution control — 3DBAG and PDOK (CC BY), the panorama API if used, and
  each texture asset's required credit. The manifest recording attribution is
  not the same as a player seeing it.

#### Visual checks

Maintain fixed desktop and mobile camera fixtures for:

- Rijksmuseum courtyard and towers;
- canal-house rows with sloped roofs;
- a terraced row deliberately split across the fidelity boundary, to prove the
  party-wall seam is absent because the row was promoted as a unit;
- mixed modern glass/concrete blocks;
- large flat industrial roofs;
- green and solar-covered roofs;
- tile boundary crossings;
- detailed loading, failure and eviction;
- active landmark highlight and click selection.

Acceptance requires no z-fighting, duplicate silhouettes, holes at replacement
boundaries, texture swimming, obvious scale errors or fallback flashes after a
tile has settled.

#### Appearance checks

Review a stratified ground-truth sample before setting automatic thresholds.
Report roof colour error, material precision/recall, abstention rate and
performance by surface size, distance, neighbourhood and observation source.
Do not use renderer screenshots as the sole truth oracle.

### Migration plan

The ordering rule is **completeness before fidelity**: every phase that makes
more of the city look like itself comes before any phase that makes a few
buildings look better. Each phase must be shippable and worth shipping alone,
because this is item 10 on a board whose P1 tier is the learning model — the
work will be interrupted, and it must be interrupted at a good state.

#### Phase 0 — answer the two questions that change the plan

**0a. Does the hosted 3DBAG tileset carry BAG IDs per feature?** One afternoon,
and it reshapes everything after it. `detailed-buildings-source.js` already
reads `EXT_mesh_features` for highlighting; the question is whether
`EXT_structural_metadata` on the same tiles resolves a feature to a `pand_id`.
If it does, measured appearance can be joined onto government geometry at
runtime with no compiler at all, and that becomes the shipping configuration
for as long as it holds up — the owned-tile compiler is then an optimisation to
be justified by measurement, not a prerequisite. If it does not, the compiler
must consume CityJSON and Phase 2 gets materially larger. Do not plan past this.

**0b. Make existing observations trustworthy.**

- Expand the roof input from appearance-tagged OSM buildings to complete BAG/
  3DBAG coverage.
- Sample actual roof planes from a pinned PDOK vintage.
- Fix provenance, multipolygons, holes and tile-boundary sampling.
- Quantize renderer colours while preserving raw observations.
- Add the BAG construction-year/use prior as an explicit `inferred` value.
- Produce a reviewed 200-roof accuracy set.

Exit: a versioned BAG-keyed appearance table, independent of the current
GeoJSON renderer.

#### Phase 1 — the complete LoD1 city, and one fallback

This is the largest visible improvement in the whole plan and it needs no new
renderer. Publish a complete BAG-keyed LoD1 building source for Amsterdam —
every pand, its footprint, its 3DBAG height, its measured or inferred roof
colour — on the spatial tiles that detailed geometry will later use. Render it
with ordinary MapLibre fill-extrusions and **remove `building-3d`,
`osm-colored-buildings` and `osm-colored-building-roofs` from the style**, along
with the height-offset stack that currently keeps three coplanar extrusions from
z-fighting.

Two things get better here at once, and the second is easy to overlook: heights
stop being guessed. Today's extrusions use the OSM `height` tag where it exists
and `levels * 3` or a flat 9 m where it does not, so much of the skyline is
invented. AHN-derived 3DBAG heights replace that everywhere, which is visible
from every camera angle and does not depend on the colour work landing.

If Phase 0a succeeded, the *shipping* configuration at the end of this phase can
already be a mix: our complete LoD1 city underneath, the existing hosted 3DBAG
LoD2.2 meshes on top wherever they have loaded, recoloured from our appearance
table and handing off per building. That is high-quality existing geometry plus
our own measurements, with no compiler written yet — and it is a legitimate
place to stop for a long time.

Exit: the whole city is coloured and measured rather than a small fraction of
it; one building source, one identity; picking returns a `BuildingHit` from the
fallback; the z-fighting workaround is deleted rather than tuned. Detailed
geometry now has exactly one thing to replace, per building group, on known tile
boundaries.

#### Phase 2 — Rijksmuseum vertical slice

- Fetch one pinned 3DBAG LoD2.2 building/part set.
- Compile roof and wall semantics into a local GLB with feature metadata.
- Apply measured roof colours and conservative wall materials.
- Render it in MapLibre, hide only that building's Phase 1 LoD1 feature by
  `buildingId`, and preserve picking/highlighting.

Exit: recognizable silhouette/courtyard, no duplicate geometry, recorded bytes,
decode time, GPU memory and frame cost.

#### Phase 3 — representative residential tile

- Compile one canal-house block with shared texture atlas and metre-scaled UVs.
- Add panorama-derived reviewed façade classifications.
- Exercise tile loading/failure/eviction and phone performance.

Exit: the block looks materially richer than flat extrusion without navigation
occlusion, shimmer or unacceptable frame cost.

#### Phase 4 — spatial streaming pilot

- Generate a multi-tile central Amsterdam corridor.
- Add deterministic LODs, manifest, content hashes and cache policy.
- Replace per-tile fallback exactly and test a complete driving route.

Exit: no tile-edge artifacts or sustained performance regression on the mobile
target.

#### Phase 5 — Amsterdam rollout

- Generate full city coverage with geometry/appearance audit reports.
- Publish versioned assets and switch the runtime manifest.
- Remove the hosted uniform 3DBAG path.

Exit: one renderer, one identity system and one fallback system. The
`buildings-colored.geojson` overlay and its duplicate geometry are already gone
at the end of Phase 1; what survives from it is the PDOK measurement, re-keyed
to BAG, as a compiler input.

#### Phase 6 — second-city contract test

- Run Utrecht through the same Dutch compiler.
- Implement the OSM/procedural geometry adapter on a city without 3DBAG-quality
  government data.
- Confirm both emit the same runtime contract.

### Rejected alternatives

#### Keep stacking coloured extrusions over the basemap

Rejected because coverage is partial, heights disagree, roofs are artificial
slabs and overlapping faces require fragile offsets to avoid z-fighting.

#### Stream hosted 3DBAG and recolour it only at runtime

**Not rejected — deferred to measurement, and possibly the answer.** If Phase 0a
shows the hosted tiles resolve features to `pand_id`, this gets real government
geometry wearing measured colours for a fraction of the compiler's cost, and
should ship while the rest of the plan is argued about.

Its real limits are worth stating honestly rather than assuming: version control
is external, so a 3DBAG republish can change what players see without a release;
the tiles are uniformly materialled, so textures are impossible; UVs are not
ours; and the appearance join costs browser bandwidth and memory that grow with
the city. Own compiled tiles buy reproducibility, offline availability and
textures. Promote to the compiler when one of those limits actually bites —
external version drift and the texture comparison in Phase 3 are the likely
triggers — not on principle.

#### OSM2World as Amsterdam's primary geometry

Rejected as the primary Dutch source because 3DBAG already provides government-
linked LoD2.2 planes reconstructed from AHN. Retain OSM2World as a procedural
reference and the geometry adapter for places without an equivalent source.

#### Photographic façade projection

Rejected because panoramas contain perspective, occlusion, lighting, people,
vehicles and licensing/privacy considerations. Classify semantic appearance and
render curated repeatable materials instead.

#### One city-sized GLB

Rejected because it prevents bounded streaming, granular caching, prompt
fallback, useful LOD selection and manageable regeneration.

### Open questions

Blocking, and answered in Phase 0a:

- Does current 3DBAG feature metadata expose BAG IDs at the granularity needed,
  or should the compiler consume CityJSON instead of hosted 3D Tiles?

Answerable later, and none of them block Phase 1:

- Which tile grid and geometric-error schedule best match the game's camera?
- Which compressed texture format is supported across the actual browser/device
  matrix without an expensive fallback atlas — and does Phase 3's comparison
  even justify textures?
- Should distinctive landmarks use bespoke authored materials while retaining
  the same geometry/identity contract?
- How many BAG panden have no usable 3DBAG reconstruction, and does the LoD1
  fallback height look wrong anywhere it matters?

Resolved above rather than left open:

- *Coverage mask versus an owned LoD1 fallback.* The mask is rejected; the owned
  fallback is Phase 1.
- *`surfaceId` stability across 3DBAG releases.* Assumed unstable. Reviewed
  overrides key on building plus surface kind so that a vintage bump cannot
  orphan human work.

Resolve the rest through the bounded pilots, not by widening the first build.


## 5. Building appearance enrichment

*Was `public/canal-drive/BUILDING_ENRICHMENT.md`.*

The runtime and mesh architecture consuming these observations is specified in
[`BUILDING_RENDERER_DESIGN.md`](BUILDING_RENDERER_DESIGN.md).

Status and implementation plan for turning government geometry and imagery into
honest, reproducible building appearance data. This document distinguishes a
measurement from a model guess: the renderer may use both, but the extract must
record which one it received and how confident it was.

### Where the repository is now

The current worktree already contains an end-to-end roof-colour prototype:

- `build-osm-building-appearance.ts` extracts separate wall and roof colours
  from OSM colour/material tags and records source fields.
- `build-satellite-roof-colours.ts` requests the open PDOK RGB orthophoto,
  caches 128 m JPEG tiles in `.cache/pdok-ortho`, erodes each OSM footprint by
  one pixel and writes the median interior RGB value when the sample is large
  and internally consistent.
- Amsterdam currently contains 10,578 appearance-backed building features.
  The local generated file has 5,778 aerial measurements and 4,800 records
  without an aerial source. The completed run cached 1,316 tiles (78 MB);
  its log recorded 3,388 existing roof values retained and 1,412 rejected
  samples.
- `vector-map.js` renders separate wall extrusions and roof caps, so sampled
  roof colours are visible instead of being copied onto walls.
- Focused colour extraction checks pass. The full appearance check still needs
  to be rerun outside the restricted shell: the `tsx` CLI failed while opening
  its local IPC socket, not on an assertion.

This is a successful prototype, not yet a dependable build stage. It is
Amsterdam-hardcoded, mutates the published GeoJSON in place, uses the moving
`Actueel_orthoHR` layer, samples only the first outer ring, assigns a building
to its centre tile even when the footprint crosses a tile edge, and has no
review artifact beyond aggregate counts. It is also not called by
`refresh-city-extract.sh`. The “keep OSM” check compares roof and wall values
rather than consulting `roofColourSource`, so its reported provenance is not
yet a trustworthy breakdown.

### Source hierarchy

Use the most direct, highest-resolution source available, and retain its date,
license and product identifier in a run manifest.

1. **OSM explicit tags** — `roof:colour`, `roof:material`, roof shape and
   building-part geometry. Explicit colour/material tags take precedence over
   imagery unless a review tool marks them stale.
2. **PDOK aerial RGB** — annual nationwide winter orthophotos at 8 cm (partly
   5 cm), CC BY. This is the primary roof-colour measurement for the
   Netherlands. Pin a named year/layer rather than `Actueel` for reproducible
   output.
3. **3DBAG LoD2.2 / AHN** — BAG-linked roof planes, slopes, ridges, heights and
   reconstruction quality. Use roof-plane polygons rather than whole OSM
   footprints to avoid courtyards and to sample sloped/stepped roofs correctly.
   3DBAG is CC BY 4.0; AHN point clouds and surface models are open government
   data.
4. **Satellietdataportaal** — repeated 30/50 cm panchromatic and 1.2/2 m
   multispectral acquisitions, with pansharpened RGB/NIR products and a STAC
   API. Use it for multi-date agreement, vegetation/green-roof detection,
   change detection and fallback for large roofs. Access requires a registered
   Dutch user and supplier-specific terms; do not publish source pixels or a
   trained model until the applicable agreement has been recorded as allowing
   that use. An irreversible per-building class or colour may qualify as a
   derivative under some agreements, but that needs an explicit license check.
5. **BAG and BGT** — authoritative BAG identity, footprint, construction year,
   status and use; BGT surface/object context around the building. These are
   useful features and validation signals, not direct evidence of colour.
6. **3D Geluid / 3D Basisvoorziening** — alternative government-derived BAG +
   AHN building parts and heights. Audit overlap and freshness before carrying
   both these and 3DBAG; prefer one canonical geometry pipeline.

#### Is there a government building-material registry?

Not a public nationwide one found in the source schemas. The national BAG
`Pand` record has identity, status, geometry and original construction year;
Amsterdam's BAG+ adds name, situation and floor counts, but not roof or façade
material. BGT's `fysiekVoorkomen` describes surfaces such as roads and terrain,
not the construction material of each BAG building. 3DBAG/AHN reconstruct roof
geometry rather than material.

Government data can still supply strong labels and exclusions:

- Amsterdam publishes annual street panorama imagery and an API under CC BY
  4.0. This is the most promising government source for *measuring façades*;
  audit its image endpoints, capture geometry and ML/derived-data terms in a
  small pilot before bulk download.
- EP-Online publishes nationwide current energy-performance records (monthly
  bulk files, free API key). Public summaries are useful for building type and
  thermal-era features, but the public API is not a material registry; detailed
  construction assemblies in an owner's energy-label report are not generally
  public per-building labels.
- Amsterdam publishes a public-domain solar-panel/roof-potential layer. Use it
  to mask panels and validate roof slope/potential, subject to checking its
  freshness; it does not label roof covering.
- Permit drawings, monument descriptions and archives often state materials,
  but they are sparse documents requiring entity linking and text extraction,
  not a clean registry. They are best used as high-quality labelled examples.

Sentinel-2 (10 m RGB/NIR) is too coarse for normal individual roofs. It can
help at block scale but is not an honest per-building colour source.

### Phase 1 — make roof colour production-safe

Deliverable: a staged Amsterdam roof-colour candidate plus a review report; no
automatic overwrite of the published extract.

1. Parameterise city, input, output, cache, imagery layer/year and attribution.
   Cache original response bytes by source, layer, CRS, bounding box and size;
   write a manifest with URL/product, capture date where available, checksum,
   license and sampler version. Keep the cache out of git.
2. Join OSM features to BAG/3DBAG identities and LoD2.2 roof planes. Sample all
   polygon parts, respect holes, and fetch/stitch every intersecting tile with
   a small halo. Do not rely on a footprint centroid.
3. Convert pixels to a perceptual colour space, exclude deep shadow, blown
   highlights, vegetation (using CIR/NIR where available), solar panels and
   obvious roof furniture, then estimate a robust dominant colour per roof
   plane. Quantise the final renderer colour to a controlled palette so flight
   and JPEG noise do not create thousands of meaningless near-duplicates.
4. Emit `roofColour`, `roofColourSource`, `roofColourConfidence`,
   `roofColourObservedAt`, `roofColourMethod`, `imageryProduct` and rejection
   reasons. Preserve explicit OSM roof colour/material separately from the
   observation; precedence belongs in one documented resolver.
5. Produce coverage by source and rejection reason, a colour histogram, and a
   deterministic HTML/GeoJSON sample sheet stratified by roof size, shape,
   neighbourhood and confidence. Manually label at least 200 buildings before
   setting thresholds. Acceptance gate: no obvious footprint leakage in the
   audit sample and a predeclared colour-error target on the labelled set.
6. Run from the city refresh into a staging directory. Publish only after the
   existing extract checks, new provenance/coverage checks and a reviewed diff
   pass. A failed imagery service must leave the OSM/material fallback intact.

### Phase 2 — roof material and texture experiment

The first classifier predicts a semantic roof material, not an arbitrary image
filename. Map the predicted material and colour to a compatible, licensed
texture only after classification. The OSM Texture Library can seed the render
palette, but its entries have per-asset licenses and limited class coverage;
store author/license/real-world scale for every selected asset.

1. Define a small visible-from-above taxonomy: clay tile, slate/dark tile,
   bitumen, metal/zinc, glass, gravel, green/vegetated, solar-dominant and
   unknown. Keep façade classes out of this model.
2. Build georeferenced chips aligned to 3DBAG roof planes, with a footprint
   mask and context channel. Split train/validation/test by neighbourhood (and
   preferably acquisition date), not randomly by neighbouring buildings, to
   prevent spatial leakage.
3. Bootstrap labels from explicit OSM `roof:material`, then manually verify a
   balanced sample. Treat weak OSM labels as weak supervision, not ground
   truth. Record imagery supplier/license on every chip and keep restricted
   imagery out of distributable training bundles.
4. Establish non-ML baselines (colour + NIR + slope + BAG age/use), then train
   an Ultralytics classification model only if the labelled dataset is large
   enough. Calibrate probabilities and support abstention; `unknown` is a good
   result when the roof is occluded, tiny or atypical.
5. Evaluate per-class precision/recall, calibration, performance by roof size
   and age, and stability across dates. Ship predictions only above per-class
   thresholds, with `roofMaterialSource=model`, model version and confidence.
6. Render a representative route and compare flat colour, generic material
   texture and predicted texture for recognition, aliasing, download size and
   mobile frame time. Do not tile a photographic roof crop onto the mesh.

### Phase 3 — façade appearance, separately

Satellite/nadir aerial pixels do not normally observe façades. BAG construction
year, use and neighbourhood can provide a prior (for example, likely brick),
but that must be stored as `inferred`, never `measured`.

For actual façade material/texture, begin with Amsterdam's CC BY 4.0 annual
panorama API, then audit other open oblique/street-level government sources and
Mapillary/KartaView, including ML-training and derived-model rights. Match
visible façade planes to 3DBAG, account for viewpoint/occlusion, and start with
a manually reviewed landmark or one-block pilot. If licensing or reliable
geometry is unavailable, retain OSM material plus an age/use prior and abstain
from texture assignment.

The first ingestion/review tool is `scripts/build-panorama-facade-review.ts`.
It deterministically selects buildings, asks the municipal API for the newest
nearby panorama and an automatically aimed crop, caches images and provenance
under `.cache/facade-review`, and emits a browser review sheet with controlled
façade material/colour, visible roof material and Dutch building-typology
labels. Typology is orthogonal to appearance: a `canal-house` may be brick,
stone or plaster and any measured colour. Passing `--model=...` asks a locally
running Ollama vision model for proposals; model output remains a hint until a
person accepts or corrects it. Panorama roof labels are accepted only when the
covering is visible; flat or hidden roofs remain unknown and use aerial/3DBAG
evidence instead.

### Recommended next run

Before training anything, repair the sampler and review 200 stratified roofs.
In parallel, register for Satellietdataportaal access and make a license/source
manifest for one Amsterdam scene, but keep PDOK 8 cm imagery as the production
colour source. The first decision gate is whether roof-plane-aware sampling can
reach reliable colour coverage; the second is whether verified material labels
are numerous and balanced enough to justify Ultralytics.


## 6. Roof enrichment

*Was `public/canal-drive/ROOF_ENRICHMENT.md`.*

Roof enrichment is an independent, observation-producing pipeline on branch
`feat/roof-enrichment`. It does not mutate BAG geometry, OSM appearance tags or
renderer inputs.

### Stages

1. `npm run cache:roof-buildings` caches active BAG buildings whose centroids
   fall inside the polygon derived from OSM A10 relation 165334.
2. `npm run build:roof-observations -- --limit=500` caches shared PDOK
   `Actueel_orthoHR` tiles and measures roofs in inside-out order from Dam.
3. `npm run build:roof-review` generates the low-confidence-first human review
   interface at `.cache/roof-enrichment/review/index.html`.

The sampler requests 1024-pixel images for 128-metre tiles (12.5 cm/pixel),
supports buildings crossing tile boundaries, Polygon/MultiPolygon geometry and
holes, and erodes masks by one pixel. Shadow, vegetation and blown-highlight
pixels are counted and excluded. Results retain measured RGB, a constrained
palette colour, confidence, method version, imagery product, pixel diagnostics,
tile keys and review status.

### Current limitations

- `Actueel_orthoHR` does not expose acquisition date in the WMS response used by
  the sampler; `observedAt` remains null rather than inventing one.
- BAG footprints describe buildings, not individual roof planes. Mixed glass,
  tile, solar and extension roofs therefore receive low confidence. 3DBAG roof
  surfaces are the next geometry source to integrate.
- The first estimator uses an eroded per-channel median. Human review of the
  stratified pilot should decide whether dominant-cluster colour is better for
  mixed roofs before scaling across the A10.
- Roof material is a separate future observation. It must not be inferred from
  the quantized colour alone.

### Feasibility conclusion

The 140-building pilot spans central Amsterdam, De Pijp, Oud-West and
Houthaven. It proved that the imagery cache, complete masks, observation schema
and human-review workflow work, but it also showed that exhaustive roof-colour
measurement is currently low leverage for the rendered city:

- much of the visible distribution is genuinely dark grey, weathered and low
  saturation;
- a single colour per BAG footprint blends roof planes, extensions, glass,
  dormers, plant cover and solar installations;
- conservative quantization suppresses what little variation remains; and
- at the intended oblique street/canal viewpoints, correct roof shape and a
  few distinctive materials matter more than small per-building colour shifts.

Pause the citywide run. Preserve this branch and cache as a reproducible pilot.
Later, use aerial evidence selectively for distinctive classes such as orange
clay tile, slate, green copper, glass, vegetation, solar-dominant roofs and
landmarks. Ordinary roofs should use shape/material/age priors until 3DBAG roof
planes can support separate observations rather than one blended footprint.
