# Da Costa expansion inventory — 9 September 2026

## Outcome

A reusable, source-pinned metadata stage now inventories a **roughly 550 m square** around `[4.87355, 52.37230]`. This is an approximate expansion candidate, **not ten counted street blocks** and not the eventual 100-block boundary.

The run downloaded **35 public JSON pages, 29,486,800 bytes**, with **zero imagery downloads and zero paid model calls**. The existing demo, extraction manifest, source imagery and human reviews were not modified. All four source families completed their pagination checks. Two subsequent offline runs produced identical report content and identity.

| Inventory | Count | Meaning |
| --- | ---: | --- |
| BAG footprints | 844 | Includes historical/status records and buildings intersecting the boundary |
| Operational footprints | 825 | 811 in use, 4 in use but not surveyed, 10 under renovation |
| VBO/unit records | 4,069 | Not a count of buildings or every distinct address |
| Operational units with issued primary addresses | 3,731 | Spread across 30 named streets |
| Panorama metadata in 420 m query radius | 13,998 | Includes a halo outside the square |
| Land panorama metadata inside the square | 8,162 | 2,285 from 2022; 2,917 from 2023; 1,511 from 2024; 1,449 from 2025 |
| Municipal tree records | 509 | Inventory positions, not reconstructed crowns |

The original 103-frontage demo is therefore a much smaller extraction sample than this candidate. More panorama positions do not prove usable crops, clear roofs or complete street coverage.

## Bounds and provenance

- WGS84 west/south/east/north: `[4.869505, 52.36983, 4.877595, 52.37477]`.
- Four-corner RD envelope: `[119742.41885, 487005.34027, 120297.24176, 487558.88388]`.
- Versioned configuration: `scripts/city-appearance/areas/da-costa-expansion-550m-v1.json`.
- Exact source URLs, retrieval timestamps, raw-byte hashes and pagination evidence are retained in the report. BAG and VBO completed their next links (1 and 5 pages); panoramas matched the advertised 13,998 total (28 pages); WFS trees completed a short page (1 page).
- Initial complete, tested inventory hash: `df490817c6e82fc2137802f7de27cf651dc2499c1cfd3bf4ecde883f5ca82c87`.
- Artifact directory: `.cache/city-appearance/areas/da-costa-expansion-550m-v1/inventory/<inventoryHash>/` containing `inventory.json`, `baseline-pins.json` and `candidate-footprints.geojson`.

Sources: [PDOK BAG footprints](https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=4.869505,52.36983,4.877595,52.37477&limit=1000&f=json), [PDOK BAG units](https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=4.869505,52.36983,4.877595,52.37477&limit=1000&f=json), [Amsterdam panorama metadata](https://api.data.amsterdam.nl/panorama/panoramas/?near=4.87355,52.3723&radius=420&srid=4326&page_size=500&timestamp_after=2022-01-01), [Amsterdam trees](https://api.data.amsterdam.nl/v1/wfs/bomen/v1?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=app:stamgegevens&COUNT=1000&OUTPUTFORMAT=application/json&BBOX=4.869505,52.36983,4.877595,52.37477,urn:ogc:def:crs:OGC::CRS84&SRSNAME=urn:ogc:def:crs:OGC::CRS84).

## Storage scenarios, not spending authorization

The current extraction manifest references **169 unique panoramas / 500,237,704 bytes** and **412 current crops / 41,485,032 bytes** for 103 frontages. These measurements exclude retired crops, screenshots, backups and other experiments. Their exact bytes and manifest are pinned independently of human reviews.

Applying the observed storage per frontage to illustrative scenarios gives:

| Scenario | Frontages | Panorama storage | Current-crop storage |
| --- | ---: | ---: | ---: |
| One frontage per operational building | 825 | 4.01 GB | 0.33 GB |

## Full public-source promotion — 10 September 2026

The metadata boundary has now been promoted through the reusable full acquisition and geometry
pipeline. The source cache contains 156 provenance sidecars/pages spanning BGT, BAG, 3DBAG,
addresses, trees, moorings and 13,998 land-panorama metadata positions. It replays offline. No
panorama pixels or paid inference were added.

3DBAG returned 814 complete CityJSONFeature envelopes / 1,628 unique CityObjects while advertising
1,626 objects. Its documented non-OGC pagination completes an envelope across the page cursor,
creating a bounded two-object overflow. The acquisition gate now accepts only a unique-ID final
overflow no larger than one returned envelope, records it as
`advertised-count-envelope-overflow`, and continues to reject shortages, duplicates, larger
discrepancies, and all ordinary OGC page-count mismatches.

Run `16288822…` compiles 825 buildings, 968 public-facing candidate walls and 2,839 context owners
through compile, inventory, building-tile and context-tile jobs. An immediate rerun reused all four
content-addressed outputs.
The later line-capable release compiler also assigns the 327 already-acquired BGT separation lines,
bringing the published context owner grid to 3,166 without another download; only 35 explicitly
classified quay-wall/bank-protection lines are selected for visible canal-edge treatment.
| Two frontages per operational building | 1,650 | 8.01 GB | 0.66 GB |

These are decimal GB, **not a confidence interval or a download request**. They do not account for reuse across nearby frontages or existing source caches, and exclude aerial imagery, 3D geometry and GPU memory. A real frontage inventory and source-selection pass must replace the assumed 1–2 ratio before acquisition.

No API-cost estimate is fabricated from historical research spend. Model choice, request size, retries and escalation rate require their own measured budget reservation. The existing **$5 cumulative ceiling is unchanged**.

## Reusable stage and checks

```sh
rtk proxy node --import tsx scripts/city-appearance/inventory-expansion.mjs --dry-run
rtk proxy node --import tsx scripts/city-appearance/inventory-expansion.mjs --offline
rtk proxy node --import tsx scripts/city-appearance/inventory-expansion.test.mjs
```

Without `--offline`, the stage acquires missing metadata pages only. It has a maximum of 40 pages per source family and preserves partial-source failures explicitly rather than reporting complete coverage. Cache bytes require matching URL and SHA; changed config or source bytes change identity. Code dependencies, area ID and baseline imagery are pinned. The test suite checks offline identity, geometry/halo counts, current-status filtering, image deduplication, changed bytes and rejected corrupt caches.

This inventory is intentionally **not** an `acquisition.json` claiming a complete compilable area. It contains no BGT ground surfaces or 3DBAG geometry. The next safe step is to select a smaller contiguous demonstration tranche from these footprints, acquire its geometry with normal completeness checks, compile conservative tiles, and select a capped set of usable panorama sources before any extraction spending.
