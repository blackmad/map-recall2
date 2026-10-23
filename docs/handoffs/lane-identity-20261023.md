# Lane: identity for the dominant buildings (P)

Plan §3. Rules: `LANE-RULES.md`. All 1,828 rows of
`public/canal-drive/dominant-building-backlog.json` have `name: null`. A
building without a name can be ride-visible (it counts) but cannot be a POI
with a card. This lane names the top 600 by `rideVisibility.score` from open
data, with a source URL per name, and never guesses.

## Script (haiku writes it, scripts/landmarks/identify-dominant.ts)

For each candidate pand, in order of `rideVisibility.rank`:

1. **BAG**: the verblijfsobjecten of the pand and their `gebruiksdoel`
   (kantoor, onderwijs, bijeenkomst, gezondheidszorg, winkel, woon…), the
   openbare ruimte name and house numbers (PDOK BAG API, CC0; cache under
   `.cache/bag-vbo/<pand>.json`). Function and address come from here.
2. **OSM**: `name`, `amenity`, `building`, `operator` of any way or relation
   whose centroid lies inside the footprint (the archived pbf the
   `road-marks-v1` builder reads; see `scripts/own-ground/build-road-marks.ts`
   for how it opens it).
3. **Monuments**: the RCE register (CC0) and data.amsterdam.nl `monumenten`
   by pand id: name, architect, year.
4. Write into the backlog row: `name`, `function`, `address`, `nameSource`
   (`osm|monument|bag-address`), `sourceUrl`, `confidence` (1.0 monument or
   OSM name, 0.6 operator-only, 0.3 address-only). Never invent a name: an
   address is written as `address`, not as `name`.

Print a table: how many of the top 250 and top 600 got a name, by source.

## Lookup pass (haiku, only for rows with confidence < 0.7)

One lookup per building, Wikipedia or OSM only, the URL recorded in
`sourceUrl`; if nothing names it, leave `name` null and write
`"lookup": "none found <date>"`. No web page other than those two.

## Hand-off into the queue

`npm run factory:queue -- --write` picks the new names up (`name` on the
queue row, the factory's house id becomes `<slug>-<pand6>` for new rows).

## Acceptance

≥ 70 % of the top 250 named with a source URL; 0 names without a URL; the
table in the report; the backlog file committed on the lane branch.
