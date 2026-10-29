# Landmark targets by ride visibility (2026-10-29, issue #104)

Named buildings that are generic, kit-only or held, ranked by the ride-visibility score of `scripts/building-recipes/ride-visibility.ts` (2000 seeded routes, 9271 km, seed 7; score = sum of route metres x passes x visible facing-wall metres). 197 open candidates; top 40 below. Machine-readable: `docs/reports/landmark-targets-20261029.json`. Regenerate: `node --max-old-space-size=8192 --import tsx scripts/building-recipes/landmark-targets.ts` (about 40 s).

Sources: `dominant-building-backlog.json` (1,828 candidates; only named ones count; monument register data from its `identity.monument`), `landmark-backlog.json` (pending and procedural-kit building/complex entries, scored on the pand under the POI point, plus pands of at least 200 m2 within 25 m for `complex` treatments). Rows from both lists that share a pand, or share a name, are merged and their scores added. No Wikipedia fetch was done: names and notability come from OSM names, the monument register fields and the POI backlog notes.

State: `generic` = no GLB, kit or large recipe covers the pand; `kit` = authored procedural kit exists. Bespoke coverage is every `signature-landmarks.json` model (359) matched to pands by footprint centre and radius, plus the backlog's manual-model entries.

Cheaper tier is a heuristic (heritage status, footprint at least 1,200 m2 or height at least 25 m, height at least 60 m); the photo decides, and the likeness bar applies.

| # | Building | Pand id(s) | Score | Routes | State | Footprint m2 / height m | Why notable | Tier |
|---|---|---|---|---|---|---|---|---|
| 1 | Prins en Keizer | w1489746218, w1489746219, w1489746221 (+1) | 8,433,054 | 164 | generic | 13,379 / 9 | Raised parts or underpass risk, Complex footprint | large recipe |
| 2 | Nederlandse Film en Televisie Academie | 0363100012170259 | 2,020,816 | 235 | generic | 2,164 / - | university; prominence 308; Film and Television Academy; school occupying rooms in an ordinary building. | large recipe |
| 3 | Academie van Bouwkunst | 0363100012171994 | 1,228,267 | 173 | generic | 1,925 / - | university; prominence 293; Academy of Architecture; school in ordinary building, no BAG pand matched at point | large recipe |
| 4 | Kalverpassage | 0363100012165086 | 1,226,981 | 232 | generic | 5,475 / 29.4 | shops, housing, offices; Mapped POI: Rasphuispoort, Complex footprint | large recipe |
| 5 | Atrium Parkeergarage | 0363100012244160 | 1,145,435 | 52 | generic | 6,681 / 67.4 | other use; parking; Tall skyline building | large recipe (tall); bespoke only if it is a recognised skyline icon |
| 6 | Belastingdienst | w57864988 | 1,088,175 | 50 | generic | 14,325 / 9 | Complex footprint | large recipe |
| 7 | Weesperplein | w268998785 | 1,030,796 | 152 | generic | 4,122 / 9 | Complex footprint | large recipe |
| 8 | Hirschgebouw | 0363100012165488 | 1,020,070 | 223 | generic | 2,738 / 27.5 | other use, offices, shops; Complex footprint, Unusual mapped roof: quadruple_saltbox | large recipe |
| 9 | DoubleTree by Hilton Amsterdam Centraal Station | w1487606275, w1487642120, w1487642116 (+14) | 899,286 | 28 | generic | 51,101 / 27 | Raised parts or underpass risk, Complex footprint | large recipe |
| 10 | De Makroon | 0363100012242951 | 797,783 | 94 | generic | 6,249 / 21.3 | housing, shops, other use; Complex footprint | large recipe |
| 11 | Y-Helling | 0363100012238702 | 543,958 | 69 | generic | 4,393 / 4.3 | industry; Simple mapped massing; facade and recognition still need visual review | large recipe |
| 12 | OBA Roelof Hartplein | 0363100012148010 | 510,391 | 101 | generic | 2,140 / - | library; prominence 182; Neighbourhood library occupying part of an ordinary plain building; not a distinctive | large recipe |
| 13 | Byzantium | 0363100012135250, 0363100012236811 | 506,158 | 99 | generic | 3,822 / 21.3 | housing, other use; Courtyard/open-space geometry, Complex footprint | large recipe |
| 14 | AkzoNobel Center | 0363100012240015, 0363100012240149 | 461,617 | 43 | generic | 11,460 / 41.5 | other use; Simple mapped massing; facade and recognition still need visual review | large recipe |
| 15 | Het Dok | 0363100012252442 | 451,371 | 28 | generic | 3,347 / 64.9 | housing, assembly/events, other use; Tall skyline building, Complex footprint | large recipe (tall); bespoke only if it is a recognised skyline icon |
| 16 | Het Nieuwe Huis | w277117928 | 449,190 | 101 | generic | 2,136 / 39.1 | Mapped POI: OBA Roelof Hartplein, Complex footprint | large recipe |
| 17 | Pakhuis Australië | 0363100012139498 | 422,695 | 46 | generic | 3,149 / 34 | housing, offices, shops; Simple mapped massing; facade and recognition still need visual review | large recipe |
| 18 | De Joodse Invalide | 0363100012170299 | 399,015 | 74 | generic | 2,657 / 31.5 | other use, housing; Courtyard/open-space geometry, Complex footprint | large recipe |
| 19 | Sint-Nicolaaslyceum | 0363100012239853 | 395,611 | 84 | generic | 3,154 / 22.4 | other use, education; Complex footprint | large recipe |
| 20 | ABN AMRO World HQ | w754717732, w754717724, w754717738 (+1) | 385,863 | 42 | generic | 3,274 / 70 | Tall skyline building, Complex footprint | large recipe (tall); bespoke only if it is a recognised skyline icon |
| 21 | Barlaeus Gymnasium | 0363100012169565 | 328,766 | 81 | generic | 872 / - | Large-tier recipe candidate; see scripts/landmarks/schools.json.; public building | building type / ordinary kit |
| 22 | KPN Teleport | 0363100012165158 | 317,215 | 28 | generic | 3,691 / 28.9 | offices; Courtyard/open-space geometry, Complex footprint | large recipe |
| 23 | Sarphati Plaza | 0363100012182840 | 315,350 | 143 | generic | 890 / 39.1 | other use, housing, offices; Complex footprint | large recipe |
| 24 | Gebouw Parnas | 0363100012153698 | 311,678 | 52 | generic | 4,337 / 29.9 | Gemeentelijk monument 222302 (1972); assembly/events, other use, offices; Simple mapped massing; facade and re | large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture |
| 25 | Hoofdgebouw | 0363100012136232 | 273,023 | 19 | generic | 12,051 / 64.7 | education; Tall skyline building, Courtyard/open-space geometry, Complex footprint | large recipe (tall); bespoke only if it is a recognised skyline icon |
| 26 | The Edge | 0363100012239633 | 266,242 | 23 | generic | 6,249 / 55.3 | other use, assembly/events, offices; Complex footprint | large recipe |
| 27 | De Valerius | 0363100012251533 | 260,722 | 31 | generic | 3,426 / 19.3 | housing, assembly/events, healthcare; Complex footprint | large recipe |
| 28 | WTC (H) | w754856621 | 247,798 | 38 | generic | 4,822 / 26 | Simple mapped massing; facade and recognition still need visual review | large recipe |
| 29 | Apollo | 0363100012148632 | 238,976 | 76 | generic | 3,014 / 24.5 | lodging; Courtyard/open-space geometry, Complex footprint | large recipe |
| 30 | Amsterdams Lyceum | 0363100012149878 | 237,209 | 32 | generic | 1,500 / - | Large-tier recipe candidate; see scripts/landmarks/schools.json.; public building | large recipe |
| 31 | Autopon | 0363100012236735 | 227,669 | 52 | generic | 2,958 / 23.7 | Rijksmonument 532201 (1955); housing, sport; Complex footprint | bespoke: Rijksmonument, ornament carries the likeness |
| 32 | Tolhuis Paviljoen | 0363100012119827 | 213,062 | 41 | generic | 2,703 / 9.2 | assembly/events; Complex footprint | large recipe |
| 33 | Pieter Nieuwlandcollege | 0363100012078546 | 205,476 | 40 | generic | 3,200 / 12.1 | Gemeentelijk monument 200659 (1958); education; Complex footprint | large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture |
| 34 | Forum | 0363100012125840 | 205,026 | 19 | generic | 5,660 / 29.9 | offices; Simple mapped massing; facade and recognition still need visual review | large recipe |
| 35 | Atlanta | 0363100012080492 | 204,779 | 80 | generic | 870 / 35.4 | Gemeentelijk monument 224005 (1929); offices, assembly/events; Simple mapped massing; facade and recognition s | large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture |
| 36 | UN Studio | w1001115825, w1001115823 | 203,578 | 43 | generic | 1,474 / 82.5 | Tall skyline building | large recipe (tall); bespoke only if it is a recognised skyline icon |
| 37 | Loods 6 | 0363100012142095 | 194,908 | 12 | generic | 6,975 / 15.9 | Gemeentelijk monument 200635 (1925); industry, shops, other use; Complex footprint | large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture |
| 38 | vm RK Technische School Dominicus Savius, nu Vliegbasis De Huygens | 0363100012113136 | 185,529 | 17 | generic | 2,717 / 17.2 | Gemeentelijk monument 200564 (1968); other use; Complex footprint | large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture |
| 39 | Brand bij C&A | 0363100012165746 | 182,750 | 48 | generic | 2,868 / 32.2 | offices, shops, assembly/events; Complex footprint | large recipe |
| 40 | Strafgevangenis | 0363100012236656 | 181,795 | 37 | generic | 4,702 / 14.5 | Gemeentelijk monument 200752 (1885); education; Complex footprint | large recipe: gemeentelijk monument, measured façade; bespoke only if the photo shows sculpture |

## Caveats
- Many names are tenants or project names from OSM (Byzantium, Argentina, Brand bij C&A is a fire event). Identify the real building before a brief.
- Prins en Keizer, DoubleTree and Kalverpassage are multi-pand complexes merged by name; the score is the sum, so they are partly a footprint effect. Check the extent before modelling.
- Walls are scored from the BAG footprint only; height and openness are not weighed.

## Small monuments in the POI backlog (prop or sign tier, not buildings)

- Kunstenaarsverzet: score 2,041,989, 188 routes
- Wind phone Hoftuin: score 334,001, 162 routes
- Grenspaal: score 191,240, 234 routes
- Plaquette 7 mei 1945: score 185,814, 220 routes
- Plaquette Chet Baker: score 149,861, 152 routes
- OBA Spaarndammerbuurt: score 78,271, 55 routes
- Monument voor Damslachtoffers 7 mei 1945: score 73,313, 80 routes
- De Knoop: score 57,870, 4 routes
- Bevrijdingslinde: score 48,933, 40 routes
- P.W. Janssen: score 44,065, 77 routes

## Existing bespoke models with low ride visibility (context only, nothing deleted)

16 of 330 matched bespoke models score 0 (no sampled route sees them); the lowest 25:

| Model | Score | Routes |
|---|---|---|
| Buiksloterkerk (`buiksloterkerk`) | 0 | 0 |
| Filmhuis Cavia / former twin-school complex (`cavia`) | 0 | 0 |
| Houten Huys — Begijnhof 34 (`houten-huys`) | 0 | 0 |
| Faralda NDSM Crane Hotel Amsterdam (`faralda-crane-hotel`) | 0 | 0 |
| Haparandaweg 9 (`haparandaweg-9`) | 0 | 0 |
| Haparandaweg 11 (`haparandaweg-11`) | 0 | 0 |
| Haparandaweg 13 (`haparandaweg-13`) | 0 | 0 |
| Kazerne Osdorp (`fire-station-osdorp`) | 0 | 0 |
| Kazerne Weesp (`fire-station-weesp`) | 0 | 0 |
| Kazerne Driemond (`fire-station-driemond`) | 0 | 0 |
| Kazerne Anton (`fire-station-anton`) | 0 | 0 |
| VOC-kade 600 (`voc-kade-600`) | 0 | 0 |
| Grasweg 116-124 (`grasweg-116`) | 0 | 0 |
| Oostenburgermiddenstraat 228 (`oostenburgermiddenstraat-228`) | 0 | 0 |
| Motorkade 1 (`motorkade-1`) | 0 | 0 |
| Noord-Zuid Hollandsch Koffiehuis and the Stationsplein pavilions (`stationsplein-paviljoens`) | 0 | 0 |
| Multatuli Museum — Korsjespoortsteeg20 (`multatuli`) | 774 | 12 |
| Uilenburger Synagoge (`uilenburger-synagoge`) | 849 | 3 |
| Da Costakade 13 (`da-costakade-13`) | 1,273 | 1 |
| Wine buyers’ guildhall / Wijnkopersgildehuis (`wine-guildhall`) | 1,314 | 31 |
| Museum De Dageraad (`dageraad`) | 1,414 | 4 |
| MidWest (`midwest`) | 2,736 | 5 |
| Meerpadkerk (`meerpadkerk`) | 3,431 | 7 |
| Petruskerk (`petruskerk`) | 4,020 | 11 |
| Herepoort / Bergpoort — Rijksmuseum garden (`herepoort-bergpoort`) | 6,632 | 21 |
