# Storefront gate (lane storefront-gate-20261110)

User report 2026-11-10: many unmodelled buildings (industrial, warehouses) carry a generic shopfront on the ground
floor. Rule now: a shopfront is drawn only where an OSM shop/amenity POI is on the building, or BAG registers
winkelfunctie or bijeenkomstfunctie for the pand.

## Paths found

| Path | Verdict |
| --- | --- |
| Busy-stretch inference, `scripts/build-shopfronts.ts` | The cause. 6,766 pands (44 % of all shop pands) got their nearest neighbour's shop with nothing checking use. Now gated on BAG (`src/canalRecall/shopGate.ts` `inferBusyStretch`): 5,270 refused, 1,496 kept. |
| `hashShop(id)`, 30 % random, `threeBuildingFeatures.ts` procedural path | Removed. Fires only when the extract is not installed (`shopfrontOf` undefined). |
| `bayLookFor` hash draw (`bayLook.ts` ~line 224: buurt `shopfrontShare` or `h % 3`) | Same condition (shopfront undefined). `meshBuildingFor` now passes `shopfrontOf(p) ?? 'quiet'`, so an undecorated feature draws no shop. `bayLookFor` itself is unchanged for the playground/Storybook callers that pass their own shopfront. |
| Large tier `shopCell` fallback, `threeBuildingFeatures.ts` `applyLargeTier` | Not a leak for generic pands: `genericSystem` never sets `groundShop`, so a quiet generic large pand gets a window ground floor. Only the three `LARGE_TIER_OVERRIDES` entries carry `groundShop` (Anne Frank House block, Kalvertoren, UvA Spui 25), each measured from a dated panorama and flagged `tuned`, which wins over the extract by design. Left alone: it is photographed evidence, not a guess. |
| Worker pool / MapLibre | No leak found. Shopfront decoration runs on the main thread (`decorateShopfront` stamps `shopKind`/`shopQuiet` on the feature); the worker only sees stamped features, so the `withWorkerFlags` gap does not matter here. The live own-engine path stamps after the extract loads (`ownWorldView.loadDecorationExtracts` then `decorateCity`); the compiled world-v1 cells carry the stamp from `scripts/world/pipeline.ts`. Before this change, tiles meshed before `shopfronts.json` arrived drew random shops until the re-decorate; now they draw none. |
| Recipe / kit / block-face ground variants | Hand-modelled pands (photo-evidenced), not touched. `bayLook` sets `shop=false` for recipes with an opening group when no shopfront is given. |

## Census (pands drawn with a shop ground floor)

Command: `npx tsx scripts/build-shopfronts.ts --no-gate --out-dir=/tmp/sg-before` (and without `--no-gate` for after),
then `npx tsx scripts/shopfront-census.ts --stage=/tmp/sg-before --stage=/tmp/sg-after`. Both use one fresh Overpass pull
(2026-11-10) so the only difference is the gate. "woonfunctie" means absent from the BAG non-housing table: housing
only, or no verblijfsobject; the register data we hold does not tell those apart, so the `unknown` column is 0.

### Before: 15,582 pands, city-wide

| source | winkel | bijeenkomst | industrie | kantoor | woon | other | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POI on building | 4,032 | 2,100 | 354 | 190 | 1,579 | 238 | 8,493 |
| busy-stretch | 1,154 | 320 | 307 | 302 | 4,289 | 284 | 6,656 |
| carried from previous extract (stale id or gone POI) | 66 | 10 | 8 | 4 | 106 | 16 | 210 |
| POI, landmark/kit pand | 18 | 37 | 2 | 2 | 42 | 3 | 104 |
| busy-stretch, landmark/kit pand | 4 | 18 | 2 | 3 | 79 | 4 | 110 |
| carried, landmark/kit pand | 0 | 0 | 0 | 0 | 9 | 0 | 9 |

### After: 10,181 pands, city-wide (-5,401)

| source | winkel | bijeenkomst | industrie | kantoor | woon | other | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POI on building | 4,032 | 2,100 | 354 | 190 | 1,584 | 240 | 8,500 |
| busy-stretch | 1,154 | 320 | 0 | 0 | 0 | 0 | 1,474 |
| carried (BAG still lists retail/horeca) | 66 | 10 | 0 | 0 | 0 | 0 | 76 |
| POI, landmark/kit pand | 18 | 37 | 2 | 2 | 46 | 3 | 108 |
| busy-stretch, landmark/kit pand | 4 | 18 | 0 | 0 | 0 | 0 | 22 |
| large-tier groundShop (photo-tuned, no POI) | 0 | 0 | 0 | 1 | 0 | 0 | 1 |

(Small differences in the POI rows between before and after are pands whose entry moved between "carried" and "POI"
classes through the stale-id carry; the `unknown` column is 0, see above.) hashShop never fires with the extract
installed, so it has no row; it is a no-extract fallback and is removed.

### Centrum (stadsdeel A)

Before 6,306 pands (busy-stretch 3,025, of which woonfunctie 1,665, industrie 191, kantoor 212); after 4,020
(busy-stretch 744, all winkel/bijeenkomst). Of the 3,025, 2,281 lose the shop.

## What is still drawn on a non-shop pand

354 industriefunctie, 190 kantoorfunctie and 1,584 housing/unknown pands still carry a shopfront because an OSM POI
sits on them (or within 8 m: the build snaps a pavement node to the nearest footprint edge). This is by the rule
(POI wins). Candidates for a later pass: require the POI to be inside the footprint when BAG says industry, or cross-check
OSM `level`/address against the VBO. The industrial kit (`industrial` stamp) already drops shops on 319 of these.

## Regression pins (`src/canalRecall/shopGate.test.ts`, node only)

Lose the guessed shop (busy-stretch before, quiet after):
- NL.IMBAG.Pand.0363100012167781 Brouwersgracht 222-H, industriefunctie 1956 (Centrum pakhuis row)
- NL.IMBAG.Pand.0363100012167782 Binnen Oranjestraat 28-H, industriefunctie 1852 (pakhuis)
- NL.IMBAG.Pand.0363100012236031 Pazzanistraat 37, industriefunctie 1885 (warehouse beside Houthaven)
- NL.IMBAG.Pand.0363100012177281 Keizersgracht 99-H, kantoorfunctie 1905 (office)
- NL.IMBAG.Pand.0363100012167815 housing-only pand beside Haarlemmerdijk 14

Keep their shop:
- 0363100012176764 Kalverstraat 152 (POI), 0363100012165204 Haarlemmerdijk 1 (POI), 0363100012176104 Haarlemmerdijk 14
  (busy stretch, BAG retail), 0363100012178875 Utrechtsestraat 54 (POI), 0363100012233666 Ferdinand Bolstraat 93A (POI).

Shopping streets by BAG retail/horeca pands: Kalverstraat 118 of 125 addressed pands keep a shop, Haarlemmerdijk 96 of 115,
Utrechtsestraat 67 of 116, Ferdinand Bolstraat 82 of 116 (the rest are office, education or other uses with no POI).

Westpoort: no pand lost a shop; the gate removes nothing there (its sheds were already quiet or in the industrial kit).

## Images

/Users/blackmad/Code/map-recall2-screenshots-a1/buildings/2026-11-10-storefront-gate/: `<spot>-<n|s>-<before|after>.jpg` for
Pazzanistraat 37, Brouwersgracht 222 / Binnen Oranjestraat 28 and Haarlemmerdijk 14 (free ride, tilt 40, looking north and
south). Taken at `?world=live` with the old and new shopfronts.json swapped in by route, because compiled world-v1 cells
carry the old stamps until `world:compile` is rerun.

What they show: `brouwersgracht-pakhuis-s-*` is the clear one. Before, the grey office/warehouse block at the lower left has a
dark-green shopfront strip along its ground floor and the row at the right has several shop signs; after, the
block's ground floor is plain and only the one real shop sign at the far right remains. The Pazzanistraat frames are
near-identical (the block is mostly hidden behind roofs at this angle) and the Haarlemmerdijk frames are occluded by roofs;
the camera pose script could not get a street-level view there, so those two spots are not visually confirmed and the node
pins above are the evidence. No Westpoort frame: the gate changes nothing there.

## Side effects

- The published `shopfronts.json` was rebuilt from a fresh Overpass pull, not only gated. A shop in the previous extract
  whose OSM node has gone (or whose pand id is stale) is carried while BAG still lists retail/horeca there
  (`carried`, 76 pands), which kept the photographed Merza, Sababa, Salento Latino and Sham storefronts.
- Gallizia (bar-ristorante, Pand 0363100012164155) now reads `shopWindow` in OSM, so the measured shop-paint table in
  `shopGrammar.ts` moved from 299 to 298 specs (black 63 to 62); `shopGrammar.test.ts` follows.
- `coarseStreetAppearance.test.ts` fails on this branch and on its base alike (`flat-lipDropped`); not caused here.

## For the integrator

1. `npm run world:compile` (the baked cells carry `shopQuiet`/`shopKind`), then covers.json, `explorer-looks.json` if it
   reads shop stamps, and the usual bundles (the `threeBuildingFeatures.ts` change reaches `three-buildings.bundle.js`
   and the world worker).
2. Add to package.json: `"test:shopfront-gate": "node --import tsx --test src/canalRecall/shopGate.test.ts"`
   (and add it to `check:canal`).
3. To refresh later: `npx tsx scripts/build-shopfronts.ts --publish`; it now needs `.cache/industrial/bag-uses.json`
   (`npx tsx scripts/industrial/fetch-bag-uses.ts`) and carries stale shops only when BAG allows them.
