# Geolocated fact pipeline

## Goal

Compile a small, attributable, offline-first catalog of facts around each supported city. The game should never wait for a third-party fact API while the player is moving.

## Source policy

### Preferred open sources

- OpenStreetMap: geometry, names, feature classification, and stable links such as `wikidata`, `wikipedia`, and heritage identifiers.
- Wikidata: entity resolution, coordinates, dates, architects, named-after relationships, heritage status, and Commons categories.
- Wikipedia: short contextual extracts and page links, discovered through linked Wikidata items or geographic search.
- Wikimedia Commons: attributable images associated with Wikidata items and categories.
- Gemeente Amsterdam monuments API: municipal and national monument geometry within Amsterdam.
- Adamlink: historical Amsterdam streets, addresses, buildings, names, and linked-data identifiers.
- Rijksdienst voor het Cultureel Erfgoed: national monument metadata and dates.
- Wikivoyage: CC BY-SA itinerary structure and explicitly attributed tour context where useful.

### Conditional sources

- izi.TRAVEL can supply structured tours and audio-guide stops, but requires an API agreement/key, usage reporting and attribution, and currently limits caching to three days. Treat it as an optional runtime/licensed connector, not part of the permanent bundled extract.

### Do not ingest without a separate agreement

- Atlas Obscura pages and commercial walking-tour sites. Store an outbound link only when useful; do not copy their descriptions, images, or tour sequences.

## Canonical record

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

## Build stages

### Implemented first slice

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

### Longer-term catalog

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

## Runtime behavior

- Build a spatial index over fact locations and geometries.
- Trigger only while the vehicle is moving slowly enough to read, or queue the fact until after a turn/quiz.
- Prefer landmarks visible on the current side of travel and within roughly 40–100 metres.
- Apply a cooldown and never show two facts simultaneously.
- Show a landmark at most once per route; allow a “repeat learned facts” preference later.
- Prioritize unseen entities, then facts relevant to the current neighborhood or destination.
- Keep the compact popup to one sentence; put images, longer context, source, and attribution in the collected postcard/detail view.
- Suppress all fact popups independently from the master game-y toggle: facts are a learning layer, not an arcade mechanic.

## Longer-term scripts

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
