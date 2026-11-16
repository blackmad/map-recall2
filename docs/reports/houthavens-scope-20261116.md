# Houthavens as unique buildings: scope (2026-11-16)

Read-only scope for TODO "Houthaven as unique buildings" (feedback 1c694c0d, 75242f30). Sources: building tiles and facts, `models/covers.json`, `house:audit`, six `house:crops` panorama crops.

## 1. Inventory: BAG/OSM pands built 2010 or later

Exposed wall = footprint edges not shared with a neighbour (courtyards included).

| Group | Pands | Exposed wall | Drawn today |
|---|---:|---:|---|
| Revaleiland | 41 (34 houses) | 1.95 km | Hotel Boat&Co (landmark), Revaleiland 437 (large recipe, `otherWalls: blank`), 39 generic |
| Houthavenkade / Haparandaweg / Blok 0 | 25 | 1.86 km | Blok 0, De Rede (landmarks); 4 block-kit GLBs; Houthavenkade 26 (large recipe); 18 generic |
| Danzigerbocht / Koivistokade (south bank) | 13 | 1.84 km | Theater Amsterdam (landmark), 12 generic |
| Memeleiland | 6 | 1.12 km | generic |
| Stettineiland (townhouses) | 90 | 1.10 km | generic |
| Narva-eiland | 5 | 1.05 km | generic |
| Libau / Karlskrona | 4 | 0.94 km | generic |
| Wiborgeiland | 11 | 0.80 km | generic |
| Pontsteiger | 5 | 0.53 km | Pontsteiger (landmark, rebuilt 2026-11-14) |
| Tasmanstraat / Danzigerkade | 4 | 0.42 km | generic |
| **Total** | **204** | **11.6 km** | 9 landmark, 4 block-kit, 2 large recipe, **189 generic (9.4 km, 81 %)** |

No house spec, kit chunk or row is published here. Generic = the new-build family (area-drawn wall, modern window preset): no longer white boxes, but nothing drawn from its own photo.

## 2. Worst offenders

| Pand | What is wrong | Visibility |
|---|---|---|
| Houthavenkade 26 / 4e Gymnasium (0363100012247232) | 12 of 510 surfaces listed, shader grid elsewhere; audit: 6 m blank, 28 m stops short | 20 m from the Houthavenkade cycleway |
| Revaleiland 437 (…250186) | `otherWalls: "blank"`, 2 wall groups for 3,785 m² | island interior |
| Blok 0 (…242823) | 5 m blank, 28 m stopping short | 36 m from Houthavenkade |
| Haparandaweg 65 (…238475) | generic; a block-kit GLB is built but held, never reviewed | **12 m**, the most visible pand |
| Haparandaweg 746-786, 788-868, 952-1002 | same: built, held | 34–41 m |
| Wiborgeiland 249707 | yellow brick and pilasters, drawn in the area palette | island |
| Memeleiland 251849 | purple-brown brick with pale bands; bands not drawn | island |

No Houthaven pand is in the ride-visibility top 40; exposure is the Haparandaweg/Houthavenkade/Tasmanstraat edge.

## 3. What the panoramas show

Crops: Memel 251849, Reval 250187, Narva 250155, Wiborg 249707, Stettin 247650 (Houthavenkade 26 rejected: wrong wall). Every block is a different design: purple-brown brick with pale bands; brown brick with stacked glass erkers; grey-brown brick with tall pale frames; yellow brick with full-height pilasters; townhouses in dark brick with white window bands. `newbuild-kit` found a shared palette, not a shared design, so one family type will not give likeness. Share *components* instead. Missing from the kit: protruding glass erkers, brick pilasters, banded brick, recessed loggias, set-backs from 3DBAG LoD1.3.

## 4. Recommendation

| Group | Route | Est. Opus tokens |
|---|---|---:|
| Held Haparandaweg GLBs (65, 746-786, 788-868, 952-1002) | review `house:frames` pairs, install or fix | 1–2 M |
| Houthavenkade 26 | Promote to a bespoke landmark (school icon, on route) | 8–15 M |
| ~20 mid-size blocks (Reval, Memel, Narva, Wiborg, Libau, south bank) | One large recipe per pand from its crop, with `otherWalls` set to the measured system (never `blank`). Add the 5 components above as typed kit parts in the first lane. | 2–3 M a pand, 40–60 M in all |
| ~124 townhouses (Stettin, Reval) | House-rows line: one series per design (about 5), stated-only | 3–5 M a series, ~20 M |
| Icons already built | None | 0 |

Full programme: **~70–100 M tokens**, 3–4 days of 2–3 lanes.

## 5. Pilot: Narva-eiland

Feedback 1c694c0d's island: 5 pands, 1.05 km of wall, all generic, usable crop.

- **Build:** one opus lane, large recipes for 250155, 247037, 247038 and the two OSM-only blocks, adding the pilaster and pale-band components; staged only, the integrator installs.
- **Blind test:** shuffled `house:frames` pairs (today vs pilot) at the panorama pose; a reviewer who did not build them picks the closer one beside the crop (`scripts/house-specs/rows/blind-review.md`). **Pass: 4 of 5 pands, no floating-window or blank-wall flags.**
- **Cost:** 10–15 M tokens, plus ~1 M review.
- **Then:** pass → Memel and Wiborg; fail → per-pand wall pins on the generic family (~0.1 M a pand).
