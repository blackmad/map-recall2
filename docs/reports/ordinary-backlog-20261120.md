# Ordinary-building backlog near the centre (2026-11-20)

David: "make sure there's a backlog of buildings near the center that have a large footprint in the 'ordinary' queue too, where work has a high payoff." The dominant backlog (`public/canal-drive/dominant-building-backlog.json`) covers only giants (≥ 2,500 m² or ≥ 35 m, city-wide). This report ranks the mid-to-large **ordinary** buildings near the Dam. It is read-only: nothing was modelled, staged or published.

- Data: `docs/reports/ordinary-backlog-20261120.json` has every core candidate, the outer-ring top 200 and all 122 clusters of 8 or more.
- Builder: `scripts/ordinary-backlog/build.ts`. The pure logic is in `core.ts` and is tested in `core.test.ts`.
- Tables: `report-md.ts`.
- Contact sheet: `contact-sheet.ts` writes `artifacts/ordinary-backlog/sheet-01.jpg` and `sheet-02.jpg`. These are local and gitignored.

## Scope and method

- **Where.** BAG pands whose footprint centroid is within **3 km of the Dam** (the core). The **3–5 km ring** is reported separately.
- **Size.** Footprint **≥ 300 m²**, counted in three bands: 300–1k, 1k–2.5k and ≥ 2.5k m².
- **What draws them today.** Every pand goes through the world pipeline's game chain (`scripts/world/pipeline.ts`: decorators, house specs, row fronts) and `meshBuildingFor`. Four ordinary paths are kept:
  - `bare`: no facade.
  - `plain-kit`: `kitWall` is plain or flat.
  - `generic`: the area-palette family.
  - `large-blank-side`: an installed large recipe whose unlisted walls are `otherWalls: "blank"` with no cited photo. Since 2026-11-14 those walls draw the shader window grid. The blank share is street-facing walls (≥ 5 m) minus photographed wall groups, as a share of street-facing walls. That is a crude count.
- **Excluded and counted.**
  - Placed models from covers.json and the catalogue: bespoke, chunk, house recipe, ordinary GLB.
  - Large recipes with every wall photographed or stated.
  - Signature-model and landmark-kit pands.
  - Building-type instances.
  - Published house specs and house rows.
  - Held installs (held.json) and held factory-queue items. Their reasons are in `held[]` in the JSON.
- **Ride visibility.** Uses `ride-visibility/v1` from `scripts/building-recipes/ride-visibility.ts` with the dominant backlog's settings: 2,000 routes, seed 7. The bike graph now gives 8,915 route-km against the backlog's 9,350, because the streets extract moved since that run.
- **Exposed street wall.** Outer-ring edges that are not party walls (2 of 3 probes 0.6 m outside are free of other BAG footprints) and that face a non-motorway routing street within 40 m.
- **Badness (0–1).**
  - bare 1.0
  - plain kit 0.85
  - large recipe 0.15 + 0.45 × blank street share
  - generic 0.35 + 0.3 × aerial plain share, plus 0.25 for **wrong period**: the monument-register year or ordekaart design year falls in a different period from the drawn style.
- **Payoff.** `rideVisibility.score × wall height (≤ 40 m) × badness / 1e6`, in "M ride-m³". The ride score already weights each route sample by the facing-wall length it sees; multiplying by height turns that into visible wall area.
- **Evidence gate.** The payoff is multiplied by 1 for a straight panorama, 0.6 for an oblique one, and 0 for blocked, none or unchecked.
  - Evidence uses house:crops' pre-download checks on the **longest road-facing wall**: Gemeente Amsterdam panoramas 5–35 m away, at most 55°, with the camera ray not crossing another footprint. "Straight" means at most 35°.
  - `pickWall` alone sometimes chose a 4 m return wall on big buildings, so the backlog takes the longest facing wall.
  - It was checked for the top 260 core, the top 65 outer, and the top 6 of the 15 biggest clusters: 336 pands in all.
  - Image-level flags (foliage, void, occluder) were not run. The contact sheet is the visual check.
- **Use and address.** From BAG verblijfsobjecten (PDOK BAG OGC API v2, CC0), 495 cells of 400 m, joined by point-in-footprint and weighted by floor area. 4,809 of 5,118 candidates have units.
- **Route rules, first match wins.**
  1. landmark: register name, listed, or ≥ 2,500 m² and ≥ 30 m.
  2. design-units: housing in a Ring design-unit segment, or terraced pre-1940 housing. These are marked for the design-units integrator.
  3. kit-fix: a member of a cluster of 8 or more.
  4. large-recipe: everything else.
- **Clusters.** Keyed on design era, use, form (tower, slab, hall, courtyard-block, block), height band (< 12, 12–24, ≥ 24 m) and drawing path.

## Findings

1. **The near-centre ordinary queue is mostly the generic family, not bare boxes.** In the core, 2,190 of 2,396 candidates are generic and 156 are bare. Bare pands sit mostly in the ring (541), on the Noord and Westpoort fringe. The generic family has almost no aerial plain share (median ≈ 0 %). Its problem is likeness: wrong wall colour, wrong window system, no balconies or arcades. "Flat from the air" is not the problem. The badness formula therefore barely separates generic buildings. Their rank comes from ride visibility × wall area.
2. **Large recipes with blank-side walls lead the individual list.** Funenpark (1,049 m of street wall, the most route-visible ordinary building in the core), Meeuwenlaan 132, Utrechtsestraat 9-17, Roetersstraat 11-23, Kattenburgerstraat 32-390 and Sarphatistraat 104 already have recipes. Photographing and stating their other walls is cheaper than a new building. On the sheet, Roetersstraat draws a red-brick grid where the street side is a pale glazed front, and Kattenburgerstraat's preview shows a 3 m sliver.
3. **Wrong period is real and cheap to fix.** 97 core pands draw a style from another period than their register or ordekaart year.
   - Kadijksplein 17-18 (1856, register) draws a white modern grid; the panorama shows a dark-brick civic front.
   - Keizersgracht 359-371 and Oostenburgergracht 15-17 are in the top 40.
   - BAG years mislead the other way too. Weesperstraat 107-121 is BAG 1891 but the photo shows a 1990s office. The check only fires where the register or ordekaart dates the design.
4. **The best investments are clusters.**
   - 1985–2004 mid-rise housing blocks: 404 members, 292 in the core, payoff 142.
   - 2005+ mid-rise housing blocks: 258 members, payoff 90.
   - 1965–84 mid-rise housing: 138 members, payoff 57. This is the Nieuwmarkt and Jodenbreestraat urban-renewal stock: Pentagon, Zuiderkerkhof, Sint Antoniesbreestraat.
   - The sheet shows what the kit cannot say for these clusters:
     - white or pale render with round balcony bands;
     - colonnaded or arcaded ground floors;
     - curved plan fronts in coloured render with strip windows (Panamalaan);
     - dark-glass bay erkers on brown brick (Weteringschans 81-89);
     - brick tone. The generic palette draws grey, white or pink where the photos show red-brown brick; the area palette, not the window grid, is the first lever.
   - 1860–1914 housing (178 members, 163 in the core) belongs to the design-units programme: 157 of them are in Ring segments or are terraced.
5. **Evidence is not the bottleneck.** 294 of 336 checked fronts have a straight panorama, 30 oblique, 9 blocked and 3 none.

## What the contact sheet shows (top 20)

These are the rows where today and the panorama differ most:

| Rank | Pand | Today | Panorama |
|---|---|---|---|
| #4 | Kadijksplein | white modern grid | dark brick, tall windows |
| #5 | Roetersstraat | red grid | pale glazed |
| #10 | Tweede Hugo de Grootstraat 43-97 | grey | red-brown brick with red shopfronts |
| #13 | Pentagon | flat brick grid | balconies on stilts over an arcade |
| #14, #16 | Panamalaan | grid | curved red/orange render with strip windows |
| #15 | Weteringschans 81-89 | grey grid | brick with glass erkers |
| #19 | Zuiderkerkhof | dark grey | white balconies and an arcade |
| #20 | Sint Antoniesbreestraat 19-37 | brown grid | salmon render with arches |

Known faults in the sheet:

- `house:preview --wall <bearing>deg` framed a short edge for #6, #7 and #12, so the "today" frame is a sliver. #2's large-recipe GLB rendered empty at that bearing.
- #17 has no thumbnail: its picked panorama was not re-found.
- The sheet is a Node render, not a ride frame. Judge likeness in situ before acting on a row.
## Counts

| Ring | Pands ≥ 300 m² scanned | Ordinary candidates | 300-1k | 1k-2.5k | 2.5k+ |
|---|---:|---:|---:|---:|---:|
| Core ≤ 3 km | 3363 | 2396 | 1915 | 397 | 84 |
| Ring 3–5 km | 2945 | 2627 | 1635 | 710 | 282 |

| Ring | generic | plain-kit | bare | large-blank-side | wrong period |
|---|---:|---:|---:|---:|---:|
| core | 2190 | 1 | 156 | 49 | 97 |
| outer | 2062 | 8 | 541 | 16 | 25 |

Excluded (core / ring): bespoke-or-model 290 / 72, held 12 / 33, landmark-kit 93 / 99, building-type 0 / 2, house-spec 525 / 25, house-row 5 / 20, clean-large-recipe 14 / 0.

Routes (core / ring): large-recipe 430 / 581, kit-fix 1427 / 1874, design-units 377 / 86, landmark 162 / 86.

Photo evidence checked for 336 pands: straight 294, oblique 30, blocked 9, none 3, unchecked 0.

## Top 40 buildings, core (≤ 3 km)

| # | Pand | Address / name | Year | m² | H m | Street wall m | Ride (M) | Today | Bad | Photo | Route | Payoff |
|---:|---|---|---:|---:|---:|---:|---:|---|---:|---|---|---:|
| 1 | 0363100012184743 | Funenpark 1-212 (+1 street) | 2002 | 9,027 | 24 | 1049 | 4.4 | large-blank-side `funenpark-427-184743` | 0.533 | oblique 43° | large-recipe | **33.91** |
| 2 | 0363100012101771 | Meeuwenlaan 132 | 1931 | 3,964 | 27.5 | 351 | 1.3 | large-blank-side `meeuwenlaan-132-101771` | 0.468 | straight 0° | landmark | **16.53** |
| 3 | 0363100012169214 | Utrechtsestraat 9-17 (+3 streets) | 1932 | 3,198 | 35.6 | 166 | 1 | large-blank-side `utrechtsestraat-15-169214` | 0.407 | straight 7° | landmark | **15.07** |
| 4 | 0363100012164985 | Kadijksplein 17-18 | 1856 | 1,815 | 18.5 | 129 | 1.3 | generic, wrong period (air 0 % plain) | 0.6 | straight 0° | landmark | **14.01** |
| 5 | 0363100012185420 | Roetersstraat 11-23 (+1 street) | 1932 | 15,975 | 39.1 | 559 | 0.6 | large-blank-side `nieuwe-achtergracht-253754` | 0.541 | straight 0° | landmark | **12.75** |
| 6 | 0363100012090765 | Stadhouderskade 12 (+1 street) | 1974 | 2,282 | 33.6 | 137 | 0.8 | generic (air 4 % plain) | 0.362 | straight 1° | large-recipe | **9.85** |
| 7 | 0363100012164930 | Kattenburgerstraat 32-390 (+1 street) | 1975 | 15,256 | 13.8 | 584 | 1.3 | large-blank-side `kattenburgerstraat-164930` | 0.547 | straight 1° | large-recipe | **9.76** |
| 8 | 0363100012165490 | Weesperstraat 107-121 (+2 streets) | 1891 | 2,021 | 31.2 | 244 | 0.8 | generic (air 2 % plain) | 0.356 | straight 3° | large-recipe | **8.55** |
| 9 | 0363100012243487 | Sarphatistraat 104 (+1 street) | 2017 | 2,609 | 20.9 | 203 | 0.8 | large-blank-side `spinozastraat-51-243487` | 0.488 | straight 0° | large-recipe | **7.72** |
| 10 | 0363100012148379 | Tweede Hugo de Grootstraat 43-97 (+1 street) | 1995 | 1,814 | 16.4 | 155 | 1.3 | generic (air 0 % plain) | 0.35 | straight 2° | kit-fix | **7.41** |
| 11 | 0363100012181841 | Weesperstraat 100-282 (+2 streets) | 1993 | 1,322 | 29.8 | 95 | 0.7 | generic (air 4 % plain) | 0.362 | straight 2° | large-recipe | **7.4** |
| 12 | 0363100012186093 | Plantage Middenlaan 50-54 (+3 streets) | 1881 | 9,430 | 22.4 | 300 | 1.5 | generic (air 2 % plain) | 0.356 | oblique 41° | kit-fix | **7.36** |
| 13 | 0363100012171628 | Pentagon 1-80 (+4 streets) | 1983 | 1,209 | 17.7 | 63 | 1 | generic (air 8 % plain) | 0.374 | straight 4° | landmark | **6.73** |
| 14 | 0363100012137509 | Panamalaan 1-7 | 2007 | 738 | 19.9 | 56 | 0.9 | generic (air 0 % plain) | 0.35 | straight 3° | kit-fix | **6.49** |
| 15 | 0363100012171823 | Weteringschans 81-89 | 1983 | 647 | 18.6 | 50 | 1 | generic (air 1 % plain) | 0.353 | straight 4° | kit-fix | **6.33** |
| 16 | 0363100012135252 | Panamalaan 2-8 | 2007 | 723 | 20.1 | 57 | 0.9 | generic (air 0 % plain) | 0.35 | straight 24° | kit-fix | **6.18** |
| 17 | 0363100012253947 | Keizersgracht 359-371 (+1 street) | 1941 | 1,356 | 22.6 | 101 | 0.7 | generic, wrong period (air 1 % plain) | 0.603 | oblique 47° | large-recipe | **6.01** |
| 18 | 0363100012171991 | Jodenbreestraat 96-138 (+2 streets) | 1966 | 1,355 | 19.8 | 101 | 0.8 | generic (air 2 % plain) | 0.356 | straight 24° | kit-fix | **5.83** |
| 19 | 0363100012171627 | Zuiderkerkhof 2-60 (+2 streets) | 1982 | 552 | 16.2 | 93 | 1 | generic (air 3 % plain) | 0.359 | straight 1° | kit-fix | **5.83** |
| 20 | 0363100012183059 | Sint Antoniesbreestraat 19-37 (+1 street) | 1988 | 1,305 | 22 | 131 | 1.2 | generic (air 1 % plain) | 0.353 | oblique 40° | kit-fix | **5.79** |
| 21 | 0363100012236745 | Tweede Hugo de Grootstraat 62-80 (+1 street) | 1934 | 747 | 17.1 | 78 | 0.9 | generic (air 1 % plain) | 0.353 | straight 2° | kit-fix | **5.6** |
| 22 | 0363100012237434 | Haarlemmerplein 10-36 (+1 street) | 2012 | 2,020 | 21 | 110 | 0.7 | generic (air 1 % plain) | 0.353 | straight 2° | kit-fix | **5.36** |
| 23 | 0363100012243817 | Cornelis Vermuydenstraat 1-103 (+2 streets) | 2016 | 1,611 | 17.8 | 181 | 0.9 | generic (air 1 % plain) | 0.353 | straight 0° | kit-fix | **5.35** |
| 24 | 0363100012254926 | Panamalaan 15-507 | 2020 | 1,874 | 24.9 | 108 | 0.6 | generic (air 0 % plain) | 0.35 | straight 1° | kit-fix | **5.34** |
| 25 | 0363100012099815 | Geuzenkade 96-103 (+1 street) | 2004 | 635 | 31.4 | 68 | 0.5 | generic (air 2 % plain) | 0.356 | straight 2° | kit-fix | **5.33** |
| 26 | 0363100012171626 | Sint Antoniesbreestraat 39-67 | 1982 | 412 | 15.4 | 42 | 1 | generic (air 1 % plain) | 0.353 | straight 4° | kit-fix | **5.3** |
| 27 | 0363100012164943 | Nieuwe Herengracht 73-89 (+1 street) | 1961 | 1,220 | 16.5 | 80 | 0.8 | generic (air 6 % plain) | 0.368 | straight 22° | kit-fix | **5.11** |
| 28 | 0363100012186086 | Westerdoksdijk 215-421 (+3 streets) | 2008 | 9,919 | 34.3 | 390 | 0.3 | large-blank-side `westerdok-186086` | 0.459 | straight 1° | landmark | **5.08** |
| 29 | 0363100012165427 | Lange Leidsedwarsstraat 1 (+1 street) | 1915 | 5,463 | 18.5 | 300 | 0.6 | large-blank-side `pand-165427` | 0.429 | straight 4° | large-recipe | **4.93** |
| 30 | 0363100012245809 | Papaverweg 45-121 (+2 streets) | 2017 | 972 | 30.2 | 89 | 0.5 | generic (air 0 % plain) | 0.35 | straight 0° | kit-fix | **4.76** |
| 31 | 0363100012169278 | Korte Prinsengracht 33-93 (+1 street) | 1954 | 1,490 | 19.9 | 80 | 0.6 | generic (air 3 % plain) | 0.359 | straight 4° | kit-fix | **4.62** |
| 32 | 0363100012165560 | Sint Antoniesbreestraat 68-120 (+1 street) | 1983 | 1,045 | 16.2 | 93 | 1.3 | generic (air 6 % plain) | 0.368 | oblique 53° | kit-fix | **4.54** |
| 33 | 0363100012170563 | Rapenburgerstraat 4-94 (+3 streets) | 1997 | 3,168 | 20.3 | 204 | 0.6 | generic (air 2 % plain) | 0.356 | straight 2° | kit-fix | **4.53** |
| 34 | 0363100012079455 | Papaverweg 43 | 2010 | 1,253 | 11.3 | 77 | 0.4 | bare | 1 | straight 1° | kit-fix | **4.48** |
| 35 | 0363100012098652 | Marcantilaan 1-57 | 1985 | 800 | 16.5 | 104 | 0.8 | generic (air 0 % plain) | 0.35 | straight 2° | kit-fix | **4.39** |
| 36 | 0363100012235882 |  | 1885 | 1,094 | 14.9 | 98 | 0.8 | generic (air 6 % plain) | 0.368 | straight 1° | large-recipe | **4.35** |
| 37 | 0363100012253740 | Oostenburgergracht 73 | 1867 | 691 | 12.8 | 61 | 0.9 | generic (air 5 % plain) | 0.365 | straight 0° | kit-fix | **4.25** |
| 38 | 0363100012079326 | Papaverweg 33 | 1990 | 2,588 | 7.1 | 332 | 0.6 | bare | 1 | straight 0° | kit-fix | **4.23** |
| 39 | 0363100012168275 | Weteringschans 165 | 1982 | 949 | 15.9 | 52 | 0.8 | generic (air 0 % plain) | 0.35 | straight 2° | kit-fix | **4.18** |
| 40 | 0363100012180539 | Oostenburgergracht 15-17 | 1919 | 392 | 17.1 | 21 | 0.4 | generic, wrong period (air 2 % plain) | 0.606 | straight 1° | landmark | **4.15** |

## Top 10 buildings, ring 3–5 km

| # | Pand | Address / name | Year | m² | H m | Street wall m | Ride (M) | Today | Bad | Photo | Route | Payoff |
|---:|---|---|---:|---:|---:|---:|---:|---|---:|---|---|---:|
| 1 | 0363100012098925 | Kramatplantsoen 1-201 (+1 street) | 1998 | 4,668 | 36.3 | 266 | 1.7 | generic (air 1 % plain) | 0.353 | straight 1° | landmark | **22** |
| 2 | 0363100012129788 | Th. K. van Lohuizenlaan 202-286 (+1 street) | 2006 | 1,150 | 23.7 | 74 | 2.3 | generic (air 0 % plain) | 0.35 | straight 1° | kit-fix | **19.12** |
| 3 | 0363100012112106 | Zeeburgerdijk 275-375 | 2004 | 1,260 | 23.1 | 78 | 1.7 | generic (air 0 % plain) | 0.35 | straight 0° | kit-fix | **13.54** |
| 4 | 0363100012061476 | Zeeburgerdijk 710-790 | 2002 | 512 | 31.6 | 34 | 1 | generic (air 2 % plain) | 0.356 | straight 2° | kit-fix | **11.1** |
| 5 | 0363100012243265 | Zeeburgerdijk 420-524 | 1925 | 1,920 | 16.4 | 96 | 1 | generic, wrong period (air 4 % plain) | 0.612 | straight 1° | design-units | **9.72** |
| 6 | 0363100012136169 | Flevoparkweg 2-72 | 2002 | 1,136 | 12 | 176 | 2 | generic (air 2 % plain) | 0.356 | straight 0° | kit-fix | **8.4** |
| 7 | 0363100012090775 | Flevoparkweg 74-114 | 2002 | 702 | 12.2 | 132 | 1.7 | generic (air 1 % plain) | 0.353 | straight 0° | kit-fix | **7.17** |
| 8 | 0363100012244665 | Mary van der Sluisstraat 496-570 (+1 street) | 2016 | 753 | 22.2 | 45 | 0.9 | generic (air 0 % plain) | 0.35 | straight 1° | kit-fix | **7.04** |
| 9 | 0363100012117643 | Zeeburgerdijk 517-555 | 2001 | 769 | 10.4 | 63 | 1.9 | generic (air 0 % plain) | 0.35 | straight 0° | kit-fix | **6.76** |
| 10 | 0363100012247342 | Nida Senffstraat 5-201 (+1 street) | 2017 | 2,829 | 25.2 | 248 | 0.8 | generic (air 0 % plain) | 0.35 | straight 0° | kit-fix | **6.69** |

## Top 10 clusters (era · use · form · drawing path)

| # | Cluster | Members (core) | Footprint m² | Street wall m | Payoff, all (core) | Photos usable / checked | Routes | Exemplars |
|---:|---|---:|---:|---:|---:|---|---|---|
| 1 | 1985-2004 · housing · block · mid · generic | 404 (292) | 241,972 | 20,219 | **142.4** (119.4) | 27 / 28 | kit-fix 404 | Zeeburgerdijk 275-375 (2004); Sint Antoniesbreestraat 19-37 (+1 street) (1988); Tweede Hugo de Grootstraat 43-97 (+1 street) (1995) |
| 2 | 2005+ · housing · block · mid · generic | 258 (112) | 274,867 | 19,522 | **90.2** (30.7) | 15 / 15 | kit-fix 258 | Th. K. van Lohuizenlaan 202-286 (+1 street) (2006); Mary van der Sluisstraat 496-570 (+1 street) (2016); John Blankensteinstraat 2-116 (+1 street) (2015) |
| 3 | 1860-1914 · housing · block · mid · generic | 178 (163) | 97,552 | 6,641 | **61.1** (57.4) | 14 / 14 | design-units 157, landmark 12, kit-fix 9 | Wittenburgergracht 77-111 (1899); Kattenburgergracht 23-41 (1868); Alexander Boersstraat 34-48 (+2 streets) (1891) |
| 4 | 1965-1984 · housing · block · mid · generic | 138 (103) | 102,588 | 8,809 | **57.4** (54.1) | 11 / 11 | kit-fix 133, landmark 5 | Sint Antoniesbreestraat 68-120 (+1 street) (1983); Pentagon 1-80 (+4 streets) (1983); Jodenbreestraat 96-138 (+2 streets) (1966) |
| 5 | 1985-2004 · housing · tower · high · generic | 29 (7) | 22,869 | 1,757 | **49.2** (14.2) | 6 / 6 | landmark 1, kit-fix 28 | Kramatplantsoen 1-201 (+1 street) (1998); Zeeburgerdijk 710-790 (2002); Geuzenkade 96-103 (+1 street) (2004) |
| 6 | 1915-1944 · housing · block · mid · generic | 176 (107) | 129,269 | 7,745 | **46.4** (31.5) | 8 / 8 | design-units 145, landmark 16, kit-fix 15 | Joh.M. Coenenstraat 32-64 (1924); Willem de Zwijgerlaan 22-38 (+2 streets) (1939); Nieuwendammerdijk 248-250 (1922) |
| 7 | 2005+ · housing · tower · high · generic | 65 (22) | 91,590 | 5,680 | **37.8** (25) | 10 / 10 | kit-fix 57, landmark 8 | Papaverweg 45-121 (+2 streets) (2017); Westerdok 4-318 (+3 streets) (2007); Marcusstraat 21-135 (+1 street) (2014) |
| 8 | 1985-2004 · housing · slab · mid · generic | 76 (46) | 77,922 | 7,332 | **35** (16) | 6 / 6 | kit-fix 76 | Flevoparkweg 2-72 (2002); Flevoparkweg 74-114 (2002); Plantagekade 2-67 (+1 street) (1990) |
| 9 | 1860-1914 · office · block · mid · generic | 27 (27) | 17,580 | 1,229 | **28.3** (28.3) | 7 / 8 | kit-fix 22, landmark 5 | Nieuwevaart 5 (1869); Marnixstraat 317 (1884); Honthorststraat 19 (1912) |
| 10 | 1915-1944 · mixed · block · mid · generic | 37 (24) | 23,570 | 1,858 | **27.2** (20.9) | 7 / 7 | kit-fix 33, landmark 4 | Tweede Hugo de Grootstraat 62-80 (+1 street) (1934); Oostenburgergracht 15-17 (1919); Jan van Galenstraat 55-85 (+2 streets) (1933) |

## Integration notes

- Proposed `package.json` entries (the integrator owns package.json):
  - `"ordinary:backlog": "node --max-old-space-size=12288 --import tsx scripts/ordinary-backlog/build.ts"`
  - `"ordinary:backlog-sheet": "node --max-old-space-size=8192 --import tsx scripts/ordinary-backlog/contact-sheet.ts"`
  - `"test:ordinary-backlog": "node --import tsx --test scripts/ordinary-backlog/core.test.ts"`
- Set `PAND_REFERENCE_CACHE` to the shared panorama cache. A rerun with the caches warm (scan, BAG cells, evidence) takes about 3 minutes. A cold run makes about 650 PDOK pages and about 300 panorama-list requests.
- The design-units rows (`route: "design-units"`, 377 core) go to the design-units integrator. They are not a lane here.
