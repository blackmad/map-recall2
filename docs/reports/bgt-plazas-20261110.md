# BGT paved plazas and forecourts as rideable ground (lane bgt-plazas-20261110)

User decision 2026-11-10 (option c of the 637f346b / 4f47f105 triage): make BGT paved plazas and forecourts rideable
city-wide, coverage report first. Lane: routing. Flag `?bgtPlazas=1`, default off.

## Verdict in one paragraph

Pedestrian paving that the municipality's BGT maps as part of the public road (wegdeel voetgangersgebied, plein,
woonerf and voetpad), at least 8 m across, and reached by a corridor, is now rideable. That covers squares, station
forecourts, quays, and market and office forecourts: 4,937 pieces, 2.07 km² of paving, 0.96 km² of it newly
rideable (78,000 m² in Centrum, for example the Waterlooplein market square). The two feedback spots stay blocked,
on purpose. Both riders stand on BGT `erf`, which is terrain belonging to a building (the club's and the office's
own ground). The same class holds every backyard, school ground and front garden in the city, so admitting it would
break the brief's "no private yards" limit. Admitting erf is a separate ruling for the user (see "Open questions").
Lawns, block courtyards and the Westpoort terminal aprons stay blocked.

## 1. Coverage (BGT 2026-10-16 wegdeel, 2026-11-10 onbegroeidterreindeel; ground level, current)

`scripts/routing/bgt-plaza-census.ts` uses a 2 m sample grid. A polygon "touches" a corridor when a sample lies
within 1 m of a corridor's guard reach, which is its playable half-width plus 4 px. "Uncovered" counts the area
that no corridor reaches.

| class (fysiek_voorkomen) | polygons | m² | Centrum polygons | Centrum m² | touch a corridor | touch, partly uncovered | uncovered m² | Centrum uncovered m² |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| wegdeel voetpad, open verharding | 76,335 | 12,424,987 | 5,748 | 1,001,854 | 57,978 | 29,606 | 5,714,289 | 278,694 |
| wegdeel voetpad, gesloten verharding | 6,186 | 1,179,051 | 189 | 30,333 | 3,394 | 1,999 | 837,719 | 18,534 |
| wegdeel voetgangersgebied, open | 886 | 547,448 | 41 | 22,212 | 526 | 411 | 337,371 | 5,746 |
| wegdeel voetgangersgebied, gesloten | 182 | 82,743 | 4 | 1,362 | 84 | 43 | 40,874 | 876 |
| wegdeel woonerf, open | 217 | 86,182 | 1 | 278 | 161 | 53 | 20,457 | 278 |
| wegdeel plein | 0 | 0 | 0 | 0 | | | | |
| wegdeel parkeervlak, open | 49,589 | 3,548,204 | 4,122 | 171,388 | 41,020 | 9,211 | 882,455 | 10,771 |
| wegdeel inrit, open | 10,821 | 526,734 | 780 | 17,532 | 8,886 | 2,819 | 156,036 | 1,560 |
| onbegroeidterreindeel, gesloten verharding | 25,183 | 6,838,124 | 1,014 | 42,009 | 14,548 | 2,608 | 5,895,934 | 26,462 |
| onbegroeidterreindeel, open verharding | 15,137 | 2,345,351 | 848 | 60,180 | 6,471 | 3,530 | 1,733,595 | 38,248 |
| onbegroeidterreindeel, half verhard | 2,875 | 652,078 | 102 | 10,278 | 1,027 | 559 | 581,274 | 7,705 |

The full table, including the half-paved and unpaved rows, is in `bgt-plaza-census.json` in the archive.

Amsterdam's BGT has no `plein`. Most squares are mapped as **voetpad**: the Dam, the Spui, the Nieuwmarkt and the
Stationsplein all are (point probe, 2026-11-10). The Leidseplein is voetgangersgebied, and the Rembrandtplein is
rijbaan. A rule limited to voetgangersgebied and plein would therefore find only 19 pieces in Centrum.

## 2. The rule (`src/canalRecall/routing/bgtPlazas.ts`, the one list the look lane imports)

- **Classes** (`RIDEABLE_PLAZA_CLASSES`): wegdeel with functie voetgangersgebied, plein, woonerf or voetpad.
- **Surface and status:** paved (open or gesloten verharding), at ground level (`h = 0`), status bestaand, not ended.
- **Width:** at least 8 m across (`BGT_PLAZA_MIN_WIDTH_METRES`). This is a morphological opening of the union of the
  classes on a 0.25 m raster. It drops sidewalks (2 to 4 m) and narrow pedestrian streets, which the corridors already
  carry. It keeps squares, forecourts and wide quays. A voetpad polygon joins the build only if it is 2.5 m deep
  somewhere, so the 82,000 sidewalk polygons do not chain into one cluster.
- **Reach:** each plaza extends 3 m (`BGT_PLAZA_REACH_METRES`) into the adjoining paved road surface (sidewalk,
  cycle path, carriageway, parking bay; never track) so that it meets the corridor of the street beside it. The
  runtime's 1.5 m inset then leaves a 1.5 m overlap.
- **Cuts:** BGT walls and fences (`scheiding_lijn` and `_vlak`: muur, hek, kademuur, damwand, geluidsscherm, ...) cut
  the plaza with a 0.6 m strip. Pieces are 4-connected, so a fence divides them even where it runs diagonally.
- **Connected:** a piece ships only if a routing corridor's edge reaches 0.5 m into it
  (`BGT_PLAZA_CORRIDOR_SLACK_METRES`). The bike crosses from the corridor to the plaza without a blocked seam. There
  are no islands.
- **Worth shipping:** a piece also needs at least 40 m² of plaza paving (`BGT_PLAZA_MIN_AREA_M2`) and must open at
  least 20 m² of ground that no corridor or square already allows (`BGT_PLAZA_MIN_OPENED_M2`).

**Rejected, with measurements** (`REJECTED_PLAZA_CLASSES`):

- **onbegroeidterreindeel, open and gesloten verharding.** The first build admitted it. It produced 5.65 km² of
  connected "plaza", and the 15 largest pieces, 2.9 km² in all, are Westpoort terminal and storage aprons. In Centrum
  the crops show closed block courtyards, one of them lawn on the 2025 ortho, plus a boat yard and car parks. Some
  quays are good, but no attribute separates them from the rest. Sheet:
  `ortho/rejected-tiers/onbegroeid-tier-sheet.jpg`.
- **erf.** Private terrain belonging to a building. Both feedback spots stand on it.
- **parkeervlak, inrit.** Car parks, and driveways into private land.

## 3. Results (staged build, 2026-11-10)

| | pieces | plaza paving m² | newly rideable m² |
|---|---:|---:|---:|
| candidate polygons | 27,844 (1,288 vg/plein/woonerf + 26,556 voetpad) | | |
| pieces ≥ 40 m² after the 8 m opening | 9,262 | | |
| reached by a corridor | 7,434 | 2,445,952 | 976,391 |
| **shipped** (opens ≥ 20 m²) | **4,937** | **2,069,392** | **960,168** |
| shipped in Centrum | 338 | | 78,343 |
| dropped: no corridor reaches them | 1,828 | 394,957 | |

The cuts removed 466,227 cells (about 29,000 m²) under fences and walls.

The extract is `public/data/extracts/amsterdam/bgt-plazas-v1.json`: 4.73 MB raw, 1.07 MB gzip, 185,662 vertices. Its
rings are simplified to 0.35 m and stored at 1e-6°. The runtime fetches it only with the flag on.

## 4. Orthophoto samples

The samples are in `map-recall2-screenshots-a1/roads/2026-11-10-bgt-plazas/ortho/`. In each crop, green marks shipped
pieces, orange marks pieces that are not shipped, blue marks corridors at their playable half-width, and red marks
BGT walls and fences.

**Should ride, and do** (`sheet-yes.jpg`):

1. Waterlooplein market square (52.36869, 4.90081).
2. The IJ quay north of Centraal.
3. A Zuidas office forecourt.
4. Oostenburg's wide quay paving.
5. A residential forecourt in Zuid.

**Should not ride, and do not** (`sheet-no.jpg`):

1. The ASC SDW forecourt (erf).
2. The Radarweg office court (erf).
3. A closed block courtyard in Oost (onbegroeid).
4. A lawn courtyard by the Amstel (onbegroeid on a lawn).
5. A Westpoort oil-terminal apron (onbegroeid).
6. The Museumplein lawn, where only the paved strip by the Van Gogh wing is green.

A random sample of six voetpad pieces outside Centrum is in `voetpad-random-sample-sheet.jpg` (taken before the
20 m² filter). All six are open public paving. One (r3, Gein) runs under tree canopy, so the ortho cannot confirm
the paving there.

## 5. Runtime and flag

- `osm-loader.js` fetches `bgt-plazas-v1.json` alongside `squares.json` when
  `CanalRecallRoadSurface.bgtPlazasEnabled(location.search)` is true, and appends the features to `plazaFeatures`.
  Everything after that is the existing square mechanism (`pedestrianAreas.ts`, `road-network.js getGuardRoad`,
  `getSurface`). A stale bundle without the reader keeps the flag off.
- `pedestrianAreas.ts` now handles polygons with holes, so a pand or a planter in a square stays blocked with the
  same 1.5 m inset. It also uses a 100 m grid index, because 4,937 pieces would otherwise mean a linear scan per
  guard query. It keeps `source: 'bgt'` pieces above 40 m² without the name checks. With no BGT features the
  output is unchanged: `test:canal-car` passes all the existing square pins.
- **Routing is untouched.** The routing graph, quiz routes, novelty routing, detour caps and spaced review all plan
  on corridors. A plaza only lets the bike stand and ride on its paving, exactly as the Dam does today. The HUD name
  on a plaza is the nearest corridor's, as on the existing squares.

**Flag:** `bgtPlazas` (`BGT_PLAZAS_FLAG`), with `BGT_PLAZAS_DEFAULT = false`. The recommendation is in section 7.

## 6. Pins (`npm run test:canal-car`, `npx tsx scripts/routing/check-bgt-plazas.ts`)

- **Waterlooplein (Centrum plein).** At 52.368690, 4.900812 the bike is blocked without the BGT plazas and rides
  with them. A 1 m flood from the Waterlooplein street corridor (52.368798, 4.901371) reaches it in 56 m only with
  the BGT plazas. The plaza also reads as asphalt to the physics.
- **Must stay blocked with the plazas on:** the Museumplein lawn (52.35770, 4.88150), the Frederiksplein lawn, and
  the Radarweg office's inner courtyard (erf, 52.387592, 4.833165).
- **Largest pieces.** The 3 largest shipped pieces ride at their deepest point, which shows that the guard's
  `roadsNear(…, 4)` plaza fallback finds a corridor contact there.
- **Ratchets 637f346b and 4f47f105.** These are not flipped. Both remain on a corridor with at least 8 of 24
  directions blocked at 12 m. A new assertion states that they also stay blocked with the BGT plazas on, because
  the ground is BGT erf.
- **`check-bgt-plazas.ts`** covers the rule (each class, height, status, erf, half verhard), the flag parser, the
  geometry helpers, the raster pipeline (fill with a hole, a straight and a diagonal fence split, the 3 m reach),
  and the plaza index (hole, inset, BGT sliver floor, legacy rings).
- **Regression runs:** `test:reachability` is unchanged; the ASC and Radarweg named places are still at 27.0 m and
  26.2 m. `test:road-surface`, `test:road-graph`, `test:road-projection` and `test:route-selection` pass.

## 7. Ride frames

`scripts/routing/bgt-plaza-ride-frames.ts` drives a real ride on port 4437 with the road-surface bundle rebuilt
locally (the bundle is not committed). Each run puts the bike at a pose, holds forward, and screenshots at the start
and the end, once with the flag off and once with it on. The frames are in
`map-recall2-screenshots-a1/roads/2026-11-10-bgt-plazas/frames/`, with `frames.json` and `frames-square.json`. The
`plazas` count is 118 with the flag off and 5,055 with it on (118 squares plus 4,937 BGT pieces).

| place, pose | off: end, metres | on: end, metres | verdict |
|---|---|---|---|
| ASC SDW 637f346b, west, 3 s | 52.385945, 4.832488; 2.9 m | identical; 2.9 m | unchanged: the bike stops at the corridor edge, because the ground is erf |
| Radarweg 4f47f105, north, 3 s | 52.387448, 4.833257; 13.7 m | identical; 13.7 m | unchanged: the bike follows the service road |
| Waterlooplein street, south-west, 4 s | 52.369100, 4.900603; 62.1 m | 52.369098, 4.900604; 61.9 m | the heading ease keeps the bike on the passage corridor in both runs, so this pose does not exercise the plaza |
| **Waterlooplein square, west, 3 s** | 52.369099, 4.900603; 39.7 m | **52.368903, 4.900316; 41.2 m** | **off:** the guard pulls the bike back to the passage corridor and it runs north to the Amstel. **On:** it crosses the market square westward, ending 30 m away |

My verdict: the flag-on frame does what the brief asks at the plein, and nothing changes at the two erf sites. The
oblique chase camera makes the difference easier to read from the end positions than from the pictures. The ground
look is identical in both runs, which is the open-ground-look lane's job.

**Recommended default: ON for desktop** once the integrator has rebuilt `road-surface.bundle.js` and split or
accepted the 1.07 MB gzip fetch. The evidence:

- every existing square pin still passes, and the new lawn and erf negatives hold;
- 0.96 km² of real public paving becomes rideable, with 10 ortho crops reviewed and 6 random samples all public paving;
- the routing graph is not touched;
- runtime cost is one fetch plus a grid lookup per guard query.

Keep it off until the look lane's "looks paved" uses `RIDEABLE_PLAZA_CLASSES` too, so that rideable and
non-rideable open ground read differently.

## 8. Open questions for the integrator and user

1. **erf forecourts (637f346b, 4f47f105).** Admitting them needs an attribute that separates an open office or club
   forecourt from a backyard. BGT has none. Possible sources are BAG gebruiksdoel (non-residential pand) combined
   with no fence and a minimum depth, or a per-site `pavedLinks.ts` ring. The triage already argued against
   per-site rings.
2. **Extract size.** The extract is 1.07 MB gzip city-wide. If the flag goes on by default, split it per own-ground
   cell, as `courtyards-v1` does.
3. **Quays.** Some onbegroeid quays are good plazas, but no attribute isolates them. Leave them for now.

## 9. What the integrator rebuilds

- `npm run build:canal-road-surface`, which writes `road-surface.bundle.js`. It carries `bgtPlazasEnabled`,
  `BGT_PLAZAS_EXTRACT`, polygon holes and the grid index. Bundles that import `roadSurface.ts` (ownGround, the world
  cache) take a few unused bytes and no behaviour change.
- `public/data/extracts/amsterdam/bgt-plazas-v1.json` is a new versioned extract committed by this lane. Rebuild it
  with `NODE_OPTIONS=--max-old-space-size=12000 npx tsx scripts/routing/build-bgt-plazas.ts --publish` (13 min) after
  a routing extract change, since the "connected" test reads roads-v2.
- No change is needed to the routing extract, graph revision, world-v1 or covers.
- npm scripts to add:
  - `"build:bgt-plazas": "tsx scripts/routing/build-bgt-plazas.ts"`
  - `"test:bgt-plazas": "tsx scripts/routing/check-bgt-plazas.ts"`, joining `check:canal`.
