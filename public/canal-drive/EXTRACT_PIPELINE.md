# The city extract pipeline

How a city becomes something the game can teach, and the rules that keep the
published files describing one city rather than several.

The game never calls a third-party API while you play. Everything it needs is a
versioned extract under `public/data/extracts/<city>/`, built here.

## Running it

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

## Adding a city

The extractor is city-agnostic: bounds, centre, curation file, boundary-lookup
name and the `cityId` filed into review keys are all arguments, and the curation
file is optional.

What is not yet city-agnostic is the **runtime**. `osm-loader.js` hardcodes
`../data/extracts/amsterdam/${dataset}.json`, so a built city cannot be reached
from the game. See TODO item 11.

## What the checks cost

| command | what it protects |
| --- | --- |
| `npm run check:amsterdam-extract` | coverage counts and enrichment of the published city |
| `npm run test:canal-car` | named streets, junctions and bridge approaches |
| `npm run test:bridge-crossings` | per-crossing identity, and bridges/index alignment |
| `npm run test:bridge-railways` | railway lines are not asked as bridges |
| `npm run test:reachability` | the routing graph reaches what it claims to |
| `npx playwright test tests/e2e/driving-harness.spec.ts` | 120 real drives; drivability, not coverage |
