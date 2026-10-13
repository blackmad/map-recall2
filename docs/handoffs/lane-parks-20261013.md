# Lane: parks modelled realistically (ground, 2026-10-13)

User 2026-10-13 (Cremerplein screenshot): a park is one flat green with a
scatter of trees around a dark box; "try to model the parks more
realistically". Real parks have paths, lawns vs planting beds, hedges,
playgrounds, benches, ponds, a kiosk or neighbourhood centre with its real
footprint.

Sources (open data only): BGT (`begroeidterreindeel` with
`fysiekVoorkomen` gras, bosschage, heesters, boomschors…;
`onbegroeidterreindeel` zand, erf, half verhard; `wegdeel` with
`functie` voetpad / fietspad and `fysiekVoorkomen`; `waterdeel`;
`scheiding` hek/muur) via the PDOK BGT download API or WFS; OSM
(`leisure=park|playground|garden`, `natural=water`, `barrier=hedge|fence`,
`amenity=bench`, `highway=footway|path`, `playground=*`); the Gemeente
tree inventory already in the game. Inputs: `src/canalRecall/ownGround/*`
(cells, `osmGround.ts` surfaces, `gameGround.ts` materials, `streets.ts`),
`public/data/extracts/amsterdam/own-ground-osm-v1/`, the defects lane's
`patch-osm-tags.ts` (how an extract is patched from Overpass and staged),
`docs/elevation.md`, HISTORY "Own ground" entries. Lane owns a new
`ownGround/parks.ts`, a `scripts/own-ground/fetch-bgt-parks.ts` extractor
writing a staged `parks-v1` extract, park materials in `gameGround.ts`,
tests and shots; ≤ 10 reported lines in `vector-map.js`. Do not edit
`decks.ts`/`bridgeKit.ts` (bridge lane), `game.js`, `index.html`,
`package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Park surfaces** inside own-ground cells: lawn, planting bed, bark,
   sand (play), gravel/half-paved and asphalt paths from BGT polygons,
   each with its own `GROUND_TONES` colour and draw rank, drawn only
   inside `leisure=park|garden|playground` or BGT park areas so streets
   are untouched. Ponds as water at the local level.
2. **Furniture kit**: hedges as low green boxes along `barrier=hedge`,
   fences and low walls along `scheiding`, benches along paths at a
   measured spacing where OSM has none, a playground kit (swing, slide,
   sandpit ring) on `leisure=playground`, lamp posts along the main paths.
3. **Buildings in parks** keep their real footprint (the Cremerplein
   neighbourhood centre, kiosks, toilets).
4. Spots: Cremerplein (user), Bellamyplein, Vondelpark (Blauwe Theehuis
   area), Oosterpark, Sarphatipark, Westerpark; chase and 300 m shots
   before/after; cost per cell (triangles, ms) on desktop.

## Checks
`npm run lint`, `npm run test:own-ground`, `npm run check:own-ground-cells`,
`OWN_GROUND=1 PW_PORT=<yours> npx playwright test own-ground-game --project=desktop`.
Report: branch, SHA, extract coverage (parks found / with BGT polygons),
shots, cost table, the `vector-map.js` lines, unfinished.
