# Lane: Wikipedia articles on plain buildings reach the building card

Rules: `LANE-RULES.md`. Model: **opus** for the join rules, the card wording
and the spoiler screen; **haiku** for the fetch/translate batch. Branch
`lane/wikipedia-buildings-20261030`. Budget: one opus session, one haiku
session. Trivia/content lane; it does not touch `game.js`, `index.html`,
`TODO.md`, `HISTORY.md` (hand back a SHA and the counts below).

User 2026-10-30, desktop screenshot on KNSM-eiland: "why isn't this
wikipedia article matched to the building?
https://nl.wikipedia.org/wiki/Emerald_Empire — are there more wikipedia
articles we should be pulling in?" The ring (Venetiëhof) opened a card that
says only "BUILT 1995 · Built in 1995, in the late twentieth century. About
27 m tall, some 9 storeys."

## Diagnosis (done 2026-10-30; verify by running, do not re-derive)

The article is in our own data. In `.cache/osm-source/derived/amsterdam-buildings.geojsonseq`
the ring is relation **r3679879**: `building=apartments`, `start_date=1995`,
`name=Emerald Empire`, `wikipedia=nl:Emerald Empire`, `wikidata=Q66764687`,
`ref:bag=0363100012102098`. Wikidata has the same item with coordinates
(P625 52.37721 N 4.94758 E). Three places each drop it:

1. **`scripts/build-amsterdam-extract.ts` `classify()`** admits a landmark
   only through `tourism`, `historic`, a civic `amenity` class or
   `tourism=museum|zoo`. A plain `building=*` with a `wikipedia` tag returns
   `null`, so it is never in `landmarks.json`, never resolved in
   `landmark-buildings.json`, and the click's first lookup
   (`src/canalRecall/game/landmarkRuntime.ts` `_cardForClickedBuilding`)
   finds nothing.
2. **`scripts/build-orientation-pois.ts` / `build-click-poi-info.ts`** start
   from an osmium filter of `amenity|shop|tourism|leisure`, so plain
   buildings are out, and POI cards carry no encyclopedia text anyway
   (Paradiso's card is category, address, website).
3. **`scripts/build-building-facts.ts`** writes `wikidata: null` and reads
   only `start_date`, `building` and the heritage tags. The row is keyed by
   the BAG pand (`P0363100012102098`), the streamed building is the pand, so
   `building.name` is empty and `describeBuilding()` falls back to the year.

## How much we are missing (measured 2026-10-30)

OSM export of 2026-09-29, Wikidata box 4.73–5.08 E, 52.28–52.43 N, compared
with every `Q…` id in `public/data/extracts/amsterdam/**.json`.
`npm run audit:wikipedia-buildings` reproduces the building numbers
(`scripts/audit-wikipedia-building-articles.ts`, staging report
`public/data/extracts/amsterdam/staging/wikipedia-building-articles.json`).

- **OSM already tells us.** 1,082,604 buildings; 1,698 carry
  `wikipedia`/`wikidata`; 8 are joined to a landmark; 1,391 are plain
  building classes the classifier never admits (380 `yes`, 342 `house`,
  268 `apartments`, 119 `commercial`, 93 `retail`, 26 `school`, 25
  `church`…). 287 of those name a Dutch article on the footprint, 2 an
  English one, 1,100 are Wikidata-only (mostly rijksmonument items).
- **Wikidata tells us more.** 6,675 items in the box have coordinates and a
  nl or en article; 1,064 share a Q-id with our extracts, 5,611 do not. By
  class: 942 bridges, 789 streets, 560 buildings, 513 sculptures, 243 works
  of art, 172 neighbourhoods, 127 statues, 111 squares, 88 murals, 79
  churches, 68 building complexes, 63 war memorials, 46 office buildings.
  Bridges and streets are matched by Q-id only here; they may be linked by
  title in `bridges.json`/`street-knowledge.json`, so audit those by title
  before counting them as missing.
- **Buildings we can place on a footprint.** 1,446 building-class items land
  inside an OSM building footprint; 189 are already linked by Q-id, name or
  title; **1,257 are unlinked anywhere**. 200 sit on footprints that already
  carry the OSM tag (the Emerald case), 1,057 need the coordinate join. 126
  have an English article, 1,131 are Dutch-only. 264 footprints have an OSM
  `name`, 993 do not (BAG pand only).
  A few famous ones already open a POI card without any blurb (Paradiso,
  Johan Cruijff ArenA, Olympisch Stadion, Magna Plaza): for them the gain is
  the text, not the card.

## What to build

1. **Typed join module** (`src/canalRecall/buildingArticles.ts` + test):
   a per-footprint article record `{ q, title, lang, url, name?, extract }`
   resolved from (a) the OSM footprint's own `wikipedia`/`wikidata` tag and
   (b) a Wikidata P625 point inside the footprint. Guards for (b): class
   allow-list (building, house, church, office, school, warehouse, hotel,
   theatre, museum, windmill, station building, gable types, building
   complex…); refuse items whose class is street, neighbourhood, village,
   bridge, polder, event or organisation; refuse when the footprint already
   carries a different `wikidata`; when two items share a footprint
   (Hirschgebouw: Q1620330 and Q2260956) keep the one with more sitelinks.
   Reuse `scripts/lib/landmarkBuildings.ts` `BuildingGrid` for the
   pand/footprint join (the same join landmarks and POIs use).
2. **Text** through the existing resolution in
   `scripts/enrich-amsterdam-wikipedia-extracts.ts` (en sitelink → Dutch
   article's interwiki → Dutch lede tagged `extractLang`) and the scrape
   store (`scripts/lib/scrapeStore.ts`), capped at 360 characters, source
   kept for translation. English in the English game; Dutch-only ledes go
   through the translation pass with provenance, per the street-name policy.
3. **Delivery.** Either a fifth slot on `BuildingFactRow` or a sibling
   `building-articles/14/x/y.json.gz` loaded by `BuildingFactStore`; ~1,300
   × ~350 B spread over z14 tiles, so the fact tile can carry it. Build goes
   to `staging/` first, `--publish` after the coverage report.
4. **Card.** `describeBuilding()` takes the article: title becomes the name
   (screened by `_spoils` exactly as monument names are; an article titled
   with an address such as "Prins Hendrikkade 600" names a street the game
   may be about to ask), detail opens with the extract, then the register
   line. Kicker stays BUILDING: this is not a landmark promotion and must not
   enter quiz or distractor pools.
5. **Landmark promotion is a separate decision.** `classify()` could admit
   `building=*` + `wikipedia` with a prominence floor, but the 420-cap and
   the distractor pools would shift; measure first, propose in the hand-back.
6. **Regressions** in `scripts/check-building-facts.mts`: pand
   `P0363100012102098` shows "Emerald Empire" with a lede that mentions Jo
   Coenen; plus Rembrandttoren (w44451577), Huis met de Kabouters
   (w277226218), Het Nieuwe Huis (w277117928), Trippenhuis (w267103172),
   Sluishuis (r21145516), and one point-join case with no OSM tag
   (Koepelkerk w22100190 / Q2122749).
7. **What's New note** with a before/after of the Venetiëhof card
   (screenshots to `blackmad/map-recall2-screenshots`, `whats-new/2026-…`).

Hand-back: SHA; joined / refused / unresolved counts by rule; how many cards
still show Dutch; the list the kit of rules could not place (for a follow-up
lane on sculptures, murals and memorials, ≈1,050 located items, which belong
to a street-side click POI rather than a building).

## Wikidata query used

```sparql
SELECT ?item ?itemLabel ?classLabel ?coord ?nl ?en ?sitelinks WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(4.73 52.28)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(5.08 52.43)"^^geo:wktLiteral . }
  ?item wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?nl schema:about ?item ; schema:isPartOf <https://nl.wikipedia.org/> . }
  OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  FILTER(BOUND(?nl) || BOUND(?en))
  OPTIONAL { ?item wdt:P31 ?class . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,nl". }
}
```

## Top unlinked building articles by sitelinks (of 1,257)

"tagged" = the OSM footprint already carries the wiki tag; "point" = found
only by the Wikidata coordinate inside the footprint.

| Wikidata | label | class | article | OSM footprint | BAG pand | how |
|---|---|---|---|---|---|---|
| Q207109 | Johan Cruyff Arena | stadium | en: Johan Cruyff Arena | r1458682 Johan Cruijff ArenA | 0363100012075730 | tagged |
| Q855003 | Defence Line of Amsterdam | fortification | en: Stelling van Amsterdam | w266639547 | 0363100012169215 | point |
| Q503319 | Olympic Stadium | stadium | en: Olympic Stadium (Amsterdam) | r898908 | 0363100012076088 | point |
| Q1180205 | De Nederlandsche Bank | central bank | en: De Nederlandsche Bank | r3598686 De Nederlandsche Bank | 0363100012165684 | tagged |
| Q253439 | Royal Netherlands Academy of Arts and Sciences | academy of sciences | en: Royal Netherlands Academy of Arts and Sciences | r3585357 | 0363100012171700 | point |
| Q50721 | Amsterdam Sloterdijk | multi-level interchange railway station | en: Amsterdam Sloterdijk station | w268460687 | 0363100012120833 | point |
| Q924769 | Pampus | artificial island | en: Pampus | w27921691 Fort Pampus Batterij | 0424100000005337 | tagged |
| Q50720 | Amsterdam Amstel | railway station | en: Amsterdam Amstel station | w1302881959 |  | point |
| Q50723 | Amsterdam Bijlmer ArenA | railway station | en: Amsterdam Bijlmer ArenA station | r3748365 | 0363100012207503 | point |
| Q1535378 | Paradiso | church building | en: Paradiso (Amsterdam) | w57857350 Paradiso | 0363100012169473 | tagged |
| Q478198 | InterContinental Amstel Amsterdam | hotel | en: InterContinental Amstel Amsterdam | w268998398 | 0363100012165491 | point |
| Q1138851 | Stopera | theatre building | en: Stopera | w751591420 Nationale Opera en Ballet | 0363100012186092 | tagged |
| Q2361620 | Rembrandt Tower | skyscraper | en: Rembrandt Tower | w44451577 Rembrandttoren | 0363100012113758 | tagged |
| Q3018576 | Sloterdijk | village | en: Sloterdijk, Amsterdam | w274066567 | 0363100012166946 | point |
| Q49870 | Duivendrecht railway station | multi-level interchange railway station | en: Duivendrecht station | w44898347 |  | point |
| Q2122749 | Ronde Lutherse Kerk | church building | en: Ronde Lutherse Kerk | w22100190 Koepelkerk | 0363100012179368 | point |
| Q1002976 | Buiksloot | village | en: Buiksloot | w977800656 | 0363100012252531 | point |
| Q50724 | Amsterdam Muiderpoort railway station | railway station | en: Amsterdam Muiderpoort railway station | w1409848101 Muiderpoortstation | 0363100012139571 | tagged |
| Q2077489 | Museum of Bags and Purses | museum | en: Museum of Bags and Purses | w267116812 | 0363100012178853 | point |
| Q1962448 | Magna Plaza | shopping center | en: Magna Plaza | w57861220 Magna Plaza | 0363100012167578 | tagged |
| Q800664 | Diemen Zuid railway station | railway station | en: Diemen Zuid station | w1013194256 |  | point |
| Q2161858 | Cobra Museum | art museum | en: Cobra Museum | w55155725 Cobra Museum | 0362100001054278 | tagged |
| Q2486332 | Waterlooplein | metro station | en: Waterlooplein metro station | w268783412 | 0363100012171835 | point |
| Q2487297 | Academic Medical Center Amsterdam | university hospital | en: Academic Medical Center (Amsterdam) | r3748079 Amsterdam UMC locatie AMC | 0363100012073816 | point |
| Q1987052 | Bovenkerk | village | en: Bovenkerk, Amstelveen | w276207439 | 0362100001067212 | point |
| Q2252756 | Trippenhuis | multifamily residential | en: Trippenhuis | w267103172 Trippenhuis | 0363100012171636 | tagged |
| Q1208561 | Diamond Museum Amsterdam | museum | en: Diamond Museum Amsterdam | w277094789 | 0363100012076129 | point |
| Q2170763 | Amsterdam municipal archive | museum | en: Amsterdam City Archives | w114542356 De Bazel | 0363100012165077 | tagged |
| Q372829 | Museum Geelvinck-Hinlopen | art museum | en: Museum Geelvinck-Hinlopen | w268283638 Geelvinck Hinlopen Huis | 0363100012167981 | tagged |
| Q945017 | Amsterdam University of Applied Sciences | vocational university | en: Amsterdam University of Applied Sciences | w44451569 Leeuwenburg | 0363100012063334 | tagged |
| Q2501300 | De Pijp | metro station | en: De Pijp metro station | w277234257 | 0363100012158607 | point |
| Q64590253 | Dutch Water Defence Lines | fortification system | en: Dutch Water Defence Lines | w266639547 | 0363100012169215 | point |
| Q2269636 | Ito-toren | skyscraper | en: Ito-toren | w277373193 | 0363100012112073 | point |
| Q2433903 | Park Plaza Victoria Amsterdam | hotel | en: Victoria Hotel, Amsterdam | w266648966 | 0363100012185508 | point |
| Q3913391 | Heilige Stede | church building | en: Heilige Stede | w266903954 | 0363100012168346 | point |
| Q2490027 | Ajax 5–1 Liverpool | association football club match | en: Ajax 5–1 Liverpool | r898908 | 0363100012076088 | point |
| Q2505167 | Astoria | office building | en: Astoria (Amsterdam) | w266616347 | 0363100012172425 | point |
| Q5017290 | Café ‘t Mandje | gay bar | en: Café 't Mandje | w267091523 | 0363100012182372 | point |
| Q19830060 | 6th Montessori School Anne Frank | primary school | en: 6th Montessori School Anne Frank | w277272562 | 0363100012108564 | point |
| Q107141506 | Sluishuis | building | en: Sluishuis | r21145516 Sluishuis | 0363100012252462 | tagged |
| Q2135814 | Hilton Amsterdam | hotel | en: Hilton Amsterdam | w57856992 | 0363100012078084 | point |
| Q2158634 | Oud Osdorp | village | en: Oud Osdorp | w274415236 | 0363100012157383 | point |
| Q1620330 | Hirsch & Cie. | fashion house | en: Hirsch & Cie | w114538347 Hirschgebouw | 0363100012165488 | tagged |
| Q1002486 | AMOLF | research institute | en: AMOLF | w103674823 | 0363100012161570 | point |
| Q2260956 | Leidsepoort | city gate | en: Leidsepoort | w114538347 Hirschgebouw | 0363100012165488 | tagged |
