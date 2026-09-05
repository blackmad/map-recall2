# The city extract pipeline

How a city becomes something the game can teach, and the rules that keep the
published files describing one city rather than several.

The game never calls a third-party API while you play. Everything it needs is a
versioned extract under `public/data/extracts/<city>/`, built here.

## Running it

```bash
npm run refresh:randstad       # all four cities (preferred)
npm run refresh:amsterdam      # one city
npm run refresh:utrecht
npm run refresh:rotterdam
npm run refresh:den-haag
bash scripts/refresh-city-extract.sh <id> <Name> <lat,lon> <BBBikeName|URL> [local.osm.pbf]
```

Pass a local `.osm.pbf` as the fifth argument to skip the download entirely.

OSM downloads and municipality cuts live in `.cache/osm-source/` and are reused
on the next run. Wikimedia/Wikipedia JSON is under `.cache/wikimedia/`. English
ledes reuse `scripts/english-translations.json`. Useful env vars:

| variable | effect |
| --- | --- |
| `REFRESH_FORCE_DOWNLOAD=1` | re-fetch BBBike / Geofabrik PBFs |
| `REFRESH_FORCE_CUT=1` | redo Rotterdam/Den Haag cuts from the province file |
| `REFRESH_OFFLINE=1` | fail on a missing OSM cache instead of downloading |

`refresh-amsterdam-extract.sh` is one `exec` into the general script. Amsterdam
gets no private path; if it did, it would drift.

Everything is built into a temporary directory and copied into
`public/data/extracts/<id>/` **only after every stage succeeds**. A transient
Wikimedia failure must not replace a working city with a half-enriched one.
Amsterdam then refreshes `neighborhoods-enriched.json` (borough postcards); a
postcard failure warns but does not roll back the extract.
## The stages

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

## Rules that are load-bearing

Each of these was learned by breaking it. They are enforced by checks, not by
memory — `npm run check:canal` runs them all.

### Connectivity is decided on raw geometry

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

### Feature ids come from identity, never from order

`extract_${category}_${grouped.size}` made an id depend on how many features of
*any* category happened to be inserted before it, so adding one classification
renumbered every bridge in the city. Ids are a hash of the grouping key now.

This matters because other files are keyed on them. It does **not** affect
player progress: spaced-repetition review keys are the feature's name plus the
place it was answered, never its extract id.

### Bridges are a matched pair

`bridges.json` and `bridge-crossings.json` are keyed on bridge id and must be
built in the same run. Publishing `bridges.json` alone once renumbered every id
and orphaned the index — matched bridges fell from 257/300 to 28/300. Nothing
crashed, which is what made it dangerous: the runtime falls back to a synthetic
crossing with no waterway, so 229 bridges silently lost the water beneath them
and the water-before-bridge rule stopped applying city-wide.

`test:bridge-crossings` now asserts that no crossing-index entry names a bridge
that does not exist, and that most bridges resolve to a real crossing.

### A road is not a bridge

OSM tags the carried road as `name` and the structure as `bridge:name`. The
extractor prefers `bridge:name`, so Zuiderzeeweg and IJburglaan are published as
Schellingwouderbrug, Amsterdamschebrug, Zeeburgerbrug and Enneüs Heermabrug —
four structures over their own waters, rather than one question answered with a
road name.

### Coverage is pinned by name, not by count

`test:canal-car` names specific streets and junctions. Counts move for
legitimate reasons; a named street disappearing does not. This is what caught
the routing network halving, and it is the reason the driving harness cannot
replace it: **a sparser network scores *higher* in the harness**, because short
routes are easier to drive.

## The Randstad

```bash
npm run refresh:randstad     # all four, each publishing independently
```

Rebuilds Amsterdam, Rotterdam, Den Haag and Utrecht. Amsterdam and Utrecht use
cached BBBike city PBFs; Rotterdam and Den Haag share a cached Zuid-Holland
province file, and each city's cut of that file is cached against the province
mtime. Enrichment hits `.cache/wikimedia/` and the English translation cache, so
a warm re-run is mostly osmium filter + extract work.

Each city is independent: one failing does not stop the rest, and each publishes
only if its own build and checks pass.

A municipality is not always mapped under the name people call it — The Hague is
`'s-Gravenhage` in OSM — so the boundary lookup matches `name`, `name:nl`,
`name:en`, `official_name` or `alt_name`.

The briefing City selector picks among Amsterdam, Utrecht, Rotterdam and Den
Haag; this command refreshes the data for all four.

## Adding a city

The extractor is city-agnostic: bounds, centre, curation file, boundary-lookup
name and the `cityId` filed into review keys are all arguments, and the curation
file is optional.

The **runtime** reads the same `cityId` from preferences and resolves extract
paths, geocode bounds and recall keys through `src/canalRecall/game/cities.ts`.
To offer a new city in the game: publish its extract, add a catalog entry with
`playable: true`, and rebuild the preferences / overlay bundles.

## What the checks cost

| command | what it protects |
| --- | --- |
| `npm run check:amsterdam-extract` | coverage counts and enrichment of the published city |
| `npm run test:canal-car` | named streets, junctions and bridge approaches |
| `npm run test:bridge-crossings` | per-crossing identity, and bridges/index alignment |
| `npm run test:bridge-railways` | railway lines are not asked as bridges |
| `npm run test:reachability` | the routing graph reaches what it claims to |
| `npm run test:transit-extract` | GVB tram/metro/ferry pins in `transit-network.json` |
| `npm run test:transit-routing` | tram 2 corridor adapts and routes end-to-end |
| `npm run check:transit` | extract + routing + prefs/overlay transit wiring |
| `npx playwright test tests/e2e/driving-harness.spec.ts` | 120 real drives; drivability, not coverage |

## Amsterdam transit (GTFS)

Public transit mode does **not** rebuild line/stop identity from OSM
`route=tram` relations. The catalog is derived from
[OVapi GTFS NL](https://gtfs.ovapi.nl/nl/gtfs-nl.zip), agency **GVB**, filtered
to tram / metro / ferry (bus deferred).

```bash
npm run build:amsterdam-transit-gtfs   # download or reuse zip, write extract
npm run test:transit-extract           # named pins (tram 2↔Dam, metro 52↔Noord)
```

| detail | value |
| --- | --- |
| Cache | `.cache/transit/gtfs-nl.zip` (and unzipped feed beside it) |
| User-Agent | `map-recall2-transit-spike/0.1 (…; research)` — required by OVapi |
| Accept-Encoding | `gzip` |
| Published artifact | `public/data/extracts/amsterdam/transit-network.json` |
| Force re-download | `npx tsx scripts/build-amsterdam-transit-gtfs.ts --force-download` |

The builder is **not** part of every CI run: the committed JSON plus
`test:transit-extract` is the gate. Rebuild when the feed needs refreshing;
stage and review before replacing the published extract.

Thin-slice play currently drives **tram 2** only (`TRANSIT_THIN_SLICE_REFS`);
the full GVB rail+ferry set stays in the extract for Phase D.
