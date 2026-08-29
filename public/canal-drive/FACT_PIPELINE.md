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

## Proposed scripts

- `scripts/facts/seed-city.ts`
- `scripts/facts/ingest-amsterdam-heritage.ts`
- `scripts/facts/enrich-wikimedia.ts`
- `scripts/facts/resolve-entities.ts`
- `scripts/facts/build-facts.ts`
- `scripts/facts/audit-licenses.ts`
- `scripts/facts/validate-facts.ts`

The existing `public/data/extracts/amsterdam/landmarks.json` can be the initial seed. The compiled output should eventually live beside it as `facts.json` and be generated—not hand-edited.
