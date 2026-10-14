# Jan Evertsenstraat survey (2026-10-14)

Plan Part 2 step 7, the survey half. It follows the Kinkerstraat survey: the
index, the faces, the intakes, the strips and the contact sheets. No intents
were authored and nothing was installed.

- Index: `scripts/street-surveys/streets/jan-evertsenstraat.json` (148 pands)
- Faces: `scripts/block-face/faces/evertsen-*/{discovery,strip,uses}.json` and
  `pands/<id>/{3dbag,facts}.json` (19 faces)
- Strip notes (trees, scaffolding), read by hand from the strips:
  `scripts/street-surveys/notes/jan-evertsenstraat.json`
- Contact sheets: `artifacts/pand-reference/contact-jan-evertsenstraat-{odd,even}.png`
  (untracked; archived)
- Archive: `map-recall2-source-data` commit `c399ed380`, branch
  `lane/jan-evertsen-survey-20261014`, not pushed. It holds
  `pand-reference-jan-evertsenstraat/` (front/alt crops and reference.json for
  207 pands, plus the two sheets), `pand-reference-walls/<id>/` (all-walls
  crops with `--min-len=3` for 21 pands) and `block-face-strips/evertsen-*/`.
  Gemeente Amsterdam panoramas, CC BY 4.0.

## How it was run

```
node --import tsx scripts/street-surveys/street-pands.ts --street="Jan Evertsenstraat"
node --import tsx scripts/street-surveys/commercial-faces.ts --street="Jan Evertsenstraat" --prefix=evertsen --style=de-baarsjes
node --import tsx scripts/pand-reference/run.ts --name=jan-evertsenstraat --street="Jan Evertsenstraat" --limit=250
node --import tsx scripts/pand-reference/run.ts --name=jan-evertsenstraat-topup --ids=<6 missed by the centroid radius>
node --import tsx scripts/pand-reference/all-walls.ts --pand=<id> --min-len=3     # 22 corner / off-front pands
node --import tsx scripts/street-surveys/commercial-intake.ts --street="Jan Evertsenstraat"
node --import tsx scripts/street-surveys/commercial-merge.ts --street="Jan Evertsenstraat" --prefix=evertsen \
  --beeldbank=docs/references/jan-evertsen-pilot/beeldbank-acquisition.json \
  --notes=scripts/street-surveys/notes/jan-evertsenstraat.json
node --import tsx scripts/street-surveys/commercial-sheets.ts --street="Jan Evertsenstraat"
```

Tooling changes made on the way:

- **Index file names.** `street-style.ts` turns a street name into a slug
  (`jan-evertsenstraat.json`, not `jan evertsenstraat.json`). All five survey
  scripts and `build.ts` use it. Single-word streets keep the same file names.
- **Style groups per district.** `commercial-faces.ts` takes
  `--style=oud-west|de-baarsjes`. Oud-West is the default, so Kinkerstraat is
  unchanged.
- **Uses.** `commercial-merge.ts` never merged them: it looped over
  `f.discovered`, which the rebuilt face list does not carry, so
  `kinkerstraat.json` has `uses` on 0 of 217 pands. The loop now reads every
  face's `uses.json` (146 of 148 here). Kinkerstraat was not re-merged here,
  because its crops are in staging dirs that this worktree does not have.
- **Beeldbank, strips and notes.** The merge now records which licensed
  Beeldbank items cover each pand (`--beeldbank`, by reference only; nothing
  was fetched), each pand's span in the fused strip, and the hand notes
  (`--notes`).
- **Street centreline fallback.** `run.ts --street` falls back to
  `streets-routing.json` when the street is missing from `streets.json`, which
  is the case for Jan Evertsenstraat.
- **Overpass back-off.** `intake.ts` now makes three rounds over its three
  Overpass endpoints, waiting 30 s and then 90 s between rounds. The first
  pass lost 6 of 19 faces to "Overpass unavailable".

The plan expected about 168 pands (1920s 117, 1910s 18). BAG has **148** pands
with a current Jan Evertsenstraat address, and widening the bbox buffer from
45 to 120 m finds the same 148. The 1910s group is 6 pands, not 18.

## Style groups

BAG bouwjaar: 1920–1929 Amsterdam School; 1910–1919; 1945 and later post-war;
everything else is "other" (all six are 1939).

| group | odd | even | all | years |
|---|---|---|---|---|
| amsterdam-school-1920s | 65 | 58 | 123 | 1925–1927 |
| 1910s | 2 | 4 | 6 | 1912–1913 |
| other (1939) | 3 | 3 | 6 | 1939 |
| post-war | 11 | 2 | 13 | 1959–2022 |

The 1910s pands are nos. 1, 4, 6–8, 7, 10–12 and 14–16, the eclectic
Oud-West end at the Admiralengracht. They read as revolutiebouw: arched heads,
white blocked surrounds, dormers. They belong with the Kinkerstraat types, not
the De Baarsjes ones. The 1939 pands (151, 153, 155, 158, 160, 162) are the
infill west of the Mercatorplein. Post-war: no. 18 (2022 infill), 164 (1959),
the Hotelschool at 171–175 (1972), the four Knijtijzer slabs 201–471 (1960–61)
with their one-storey end pavilions, and 473–781 (2006–08).

Ground floors: BAG has a winkelfunctie on 103 of the 148 pands, and OSM
matches a business on 52. Restaurants and fast food lead (10 each), then
clothes (6), cafés and hairdressers (4 each).

## Faces

Faces are proposed by cross street: frontage on the street, same facing,
joined by shared party walls. Every proposal survived intake with the same id.
One face needed a new seed: `discover.ts`, started from corner pand 107849
(no. 94), stopped after no. 96 because the next fronting pand is 13 m on with
no party wall. It was re-seeded mid-row at no. 126, as the pilot face
`_jan-evertsen-94` was, and then discovered 26 members (`seedNote` in the
index). Each strip is fused from a single capture day, and coverage is 1.0
everywhere.

| face | side | numbers | pands | of which surveyed | no-address extras | strip day | strip px | BAG years |
|---|---|---|---|---|---|---|---|---|
| evertsen-4-44 | even | 4–44 | 17 | 15 | 2 | 2021-03-26 | 6610×985 | 1913–2022 |
| evertsen-52-66 | even | 52–66 | 6 | 6 | 0 | 2024-12-06 | 1627×968 | 1927 |
| evertsen-68-92 | even | 68–92 | 10 | 10 | 0 | 2024-12-06 | 3974×904 | 1926–1927 |
| evertsen-94-142 | even | 94–142 | 26 | 25 | 1 | 2024-12-06 | 6867×1578 | 1925–1927 |
| evertsen-144-150 | even | 144–150 | 4 | 4 | 0 | 2024-12-06 | 1489×917 | 1927 |
| evertsen-152-160 | even | 152–160 | 5 | 5 | 0 | 2024-12-06 | 1330×777 | 1926–1939 |
| evertsen-1-1 | odd | 1 | 5 | 1 | 4 | 2022-12-12 | 1567×832 | 1912 |
| evertsen-7-41 | odd | 7–41 | 18 | 17 | 1 | 2021-03-26 | 4860×776 | 1912–1926 |
| evertsen-43-57 | odd | 43–57 | 8 | 8 | 0 | 2024-12-06 | 1647×878 | 1926–1927 |
| evertsen-59-89 | odd | 59–89 | 15 | 15 | 0 | 2024-12-06 | 3939×892 | 1927 |
| evertsen-91-135 | odd | 91–135 | 19 | 19 | 0 | 2024-12-06 | 6253×834 | 1926–1927 |
| evertsen-137-143 | odd | 137–143 | 4 | 4 | 0 | 2024-12-06 | 999×973 | 1926 |
| evertsen-145-155 | odd | 145–155 | 6 | 6 | 0 | 2024-12-06 | 1722×819 | 1926–1939 |
| evertsen-171-175 | odd | 171–175 | 1 | 1 | 0 | 2024-12-06 | 4026×3031 | 1972 |
| evertsen-201-267 | odd | 201–267 | 2 | 2 | 0 | 2024-12-06 | 2288×1133 | 1961 |
| evertsen-269-335 | odd | 269–335 | 2 | 2 | 0 | 2024-12-06 | 2298×1131 | 1961 |
| evertsen-337-403 | odd | 337–403 | 2 | 2 | 0 | 2024-12-06 | 2296×1132 | 1960 |
| evertsen-405-471 | odd | 405–471 | 2 | 2 | 0 | 2024-12-06 | 2306×1128 | 1960 |
| evertsen-473-781 | odd | 473–781 | 2 | 2 | 0 | 2024-12-06 | 4562×2538 | 2006–2008 |

The no-address extras are corner pands whose address is on the cross street:
46 (070963) and 157646 (the blind-arched side wall beyond no. 4) in 4–44, 158391 before no. 7, the four
Kinkerstraat/Admiralengracht pands around no. 1, and the Mercatorplein clock
tower 107349. The Amsterdam School rows to author are the 13 faces from 4–44
to 152–160 (131 pands). The six post-war faces at 171 and beyond belong to the
large tier or the ordinary kit, not to De Baarsjes types.

Capture years of the per-pand crops: 2025 47, 2022 30, 2024 28, 2019 18,
2020 10, 2021 9, 2018 3, 2016–2017 2. The 2021-03-26 strips of 4–44 and 7–41
are leaf-off.

## No sightline, no frontage, washed out

**No frontage** (address on the street, no wall facing it):
- **162** (083625, 1939): no footprint edge faces the street.
- **164** (218288, 1959): its frontage is 52 m from the street.

**No sightline: none.** Every span in all 19 strips has a panorama within
range, and no pand is hidden behind another the way Kinkerstraat 240 was. Two
pands have no usable per-pand crop and use the strip as their reference:
- **57** (126620, the stair-tower end of 43–57): its only exposed wall of 3 m
  or more is the 12 m side wall. The street front is in the strip
  (`street-front-from-strip-only`).
- **473–715** (134306, 2008, 60 m tower): not in the building tiles, so
  `all-walls.ts` cannot find it. Strip only.

Street walls replaced from all-walls crops (`crop.streetWall`): 18, 20–24, 43,
137, 144, 171–175, 203–267, 271–335, 339–403 and 717–781.

**Washed out** (`status: washed-out`, front/alt fractions): 32 (0.37/0.41),
34 (0.36/0.28), 42 (0.38/0.48), 44 (0.32/0.45), 58 (0.32/0.20), 60
(0.30/0.41), 86 (0.35/0.21), 94 (0.31/0.29), 102 (0.31/0.43), 122
(0.35/0.31), 132 (0.33/0.24) and 134 (0.32/0.29). Six more are at 0.25 or
above on one capture: 18, 20–24, 24, 40, 62 and 112. Every one of them is
legible in the fused strip of its face, so use the strip. Pale skies over flat
dark parapets cause most of these.

**Trees on the upper storeys.** The foliage metric stays at or below 0.08
everywhere, because the selection prefers leaf-off captures. The bare
branches still cover windows, so this list was read by hand from the strips
(`stripNotes`). Beeldbank items are recorded by reference only, licensed
items only. The 1960 aerial by Roel Dijkstra is copyright-protected and was
left out.

| pand | id | problem | licensed Beeldbank items covering it |
|---|---|---|---|
| 74–78 | 140338 | tree over the right half, all upper storeys | 6fab7078 (1989, 68–114), 6ce28497 (1987, 68–80), 43c5ea58 (1990, 68–92) |
| 84 | 126326 | tree over the left bay | 6fab7078, 43c5ea58 |
| 98 | 135935 | tree over the left windows | 6fab7078, 889f0144 (1987, 94–98), ad2f103f (1992, 94–98) |
| 114 | 139046 | tree over the middle column | 6fab7078 |
| 121–125 | 085815 | tree and pole ghosted over the 37 m front | 7597e032 (1988, 91–135) |
| 145 | 082977 | tree crown over the stair tower | none |
| 151, 153, 155 | 138602, 105558, 131504 | branches over every upper storey and the dormers | none |
| 152, 158 | 113386, 144634 | tree in front of the upper storeys | none |
| 87 | 077667 | scaffold netting in the 2024 strip (use the 2021/2022 crops) | none |

Altogether 63 pands carry at least one Beeldbank reference. By item:
- 7597e032 (1988, odd 91–135): 20 pands
- 6fab7078 (1989, even 68–114): 21 pands
- 5097e6db (1990, odd 9–41): 16 pands
- 43c5ea58 (1990, even 68–92): 10 pands
- 27ef9b00 (1992, odd 201–403): 6 pands
- the 94–98 and 68–72 close-ups: 3 pands each
- the 1939–43 drawings for no. 94 (copyright-free): 1 pand each

The pands west of the Mercatorplein (145–160) have no Beeldbank cover in the
acquisition. A targeted search there is the next step if their upper storeys
are needed.

## Large-tier and bespoke candidates

| pand | id | year | front width (m) | footprint (m²) | road fronts | eaves / roof max (m) | proposed treatment |
|---|---|---|---|---|---|---|---|
| Mercatorplein clock tower (in 94–142, no JES address) | 0363100012107349 | 1996 (rebuild) | 25.6 | – | 2+ | 11.8 / 37.5 | **bespoke landmark** (plan Part 2 step 8): clock tower with faces on two sides, stacked canted oriels, gateway arch to the plein, the low hipped wing with a bay over the arch |
| Mercatorplein second tower (south side, no JES address) | 0363100012073289 | 1927 | – | – | – | 29.8 (tiles) | **bespoke landmark**: the likely twin; confirm from a photo before building |
| 144 (west tower) | 0363100012106884 | 1927 | 11.9 | – | 1 (street wall from all-walls) | 20.9 / 20.9 | **bespoke or large**: a 7-storey brick tower with two stacks of pointed (canted) oriels, a brick frieze under a flat top and a dark two-arch arcade at ground |
| Mercatorplein arcades | (plein faces, no JES address) | 1927 | – | – | – | – | **bespoke with the plein**: outside this index; survey them with the landmark lane |
| OBA Mercatorplein | 0363100012151434 | 1927 | – | – | – | – | **already installed** (`houses/oba-mercatorplein`); gets the Part 1 likeness pass |
| 121–125 | 0363100012085815 | 1927 | 37.3 | 2586 | 2 | 16.8 / 18.9 | **large recipe**: one mass across five bays in the hood-lisene body, the supermarket under a continuous canopy; trees in front (Beeldbank 7597e032) |
| 52–56 | 0363100012147483 | 1927 | 8.3 | 181 | 3 | 3.2* / 17.5 | **corner mass, 3 fronts**: raised end of 52–66; 3DBAG eaves misread (*) |
| 40 + 46 (070963) | 0363100012089629 | 1927 | 4.1 | – | 1 (+ corner) | 15.5 / 22.6 | **bespoke corner** at the west end of 4–44 (with the no-address corner pand 46): a tower rising 6 m over the parapet, three-storey half-round oriels, an attic frieze of square windows on 42–44 |
| 20–24 | 0363100012062355 | 1927 | 3.4 | – | 1 (+ corner) | 16.9 / 18.3 | **corner mass**: round corner tower next to the 2022 infill at 18 |
| 35 / 31–37 / 39 / 41 | 147692, 128604, 120124, 150064 | 1926 | 4.1 / – / – / 6.2 | – | corner | 15.4 / 17.7 | **corner group** at the Admiralengracht side of 7–41: stacked canted oriels, a diamond-brick frieze under the parapet, wrapped window bands, a cast-iron balustrade over the canopy |
| 66 | 0363100012131498 | 1927 | 8.3 | – | 1 | 19.8 / 22.2 | **raised corner mass** at the Marco Polostraat corner (Beeldbank 8738f6f0 shows the street opening between 66 and 68), wide window bands |
| 91 | 0363100012070651 | 1927 | 10.4 | 176 | 2 | 3.1* / 17.9 | **stepped corner mass** at the Vespuccistraat corner, a rising brick pier with wrapped windows |
| 94 | 0363100012107849 | 1926 | 7.5 | 232 | 2 | 3.1* / 17.4 | **raised corner mass**; the 1939–43 rebuilding drawings are in the Beeldbank (120d0200, c76f4ff2) |
| 89, 92, 64 | 085532, 134746, 115017 | 1926–27 | 7.5 / 5.4 / 6.0 | 98–150 | 2 | 4.5–5.7* / 18.8–20.6 | corner ends; ordinary types with a return front |
| 55 / 57 | 120095 / 126620 | 1927 | – | – | 1 | – | **raised stair-tower end** of 43–57 (a balcony stack on 55) |
| 171–175 Hotelschool | 0363100012148630 | 1972 | 100.7 | 14269 | 2 | 12.8 / 73.8 | **large recipe**: a three-storey concrete grid front, 100 m, with the tower behind |
| 473–715 | 0363100012134306 | 2008 | 42.4 | 5562 | 1 | 60.4 / 61.4 | **large recipe** (tower); strip only, not in the building tiles |
| 717–781 | 0363100012113136 | 2006 | 71.6 | 2719 | 1 | 17.2 / 18.6 | **large recipe** |
| 203–267, 271–335, 339–403, 407–471 | 128966, 124383, 116286, 095085 | 1960–61 | 7.3–7.4 (gable end) | 544–545 | 3–4 | 23.3 / 26.3 | **ordinary kit**: Knijtijzer slabs, gable end to the street, green balcony stacks on the long side |
| 18 | 0363100012255037 | 2022 | 5.9 | 341 | 2 | 18.6 / 19.9 | ordinary kit; yellow-brick 2022 infill |
| 26–30, 74–78 | 119468, 140338 | 1926–27 | 18.0 | 211–243 | 1 | 13.7–16.8 | wide but regular: the ordinary body type repeated over 3 bays (no large recipe) |
| 6–8, 10–12, 14–16 | 097978, 148911, 105930 | 1913 | 12.1–12.4 | 287–302 | 1 | 10.5–13.9 | double houses: the Kinkerstraat 1890–1910 types, two modules each |

\* 3DBAG puts the eaves of these corner pands at 3–6 m: it is reading a
low annex or the inner courtyard. Fix them with `measuredEaves` on the face
pass.

## De Baarsjes type sketch (from the strips; not authored)

The 123 Amsterdam School pands form a few long rows by a handful of
architects. In the 1990 Beeldbank caption, 68–92 is J.F. Staal (1925–27) and
9–41 is J.M. van der Mey (fronts, 1924–25). Every row shares one street
vocabulary:
- a tall plain parapet zone of 2–3 m above the top windows, finished with a
  thin coping, and no cornice;
- three upper storeys of white-framed windows in dark brown or red brick;
- a continuous rigid canopy over the shops. On 43–135 it carries a
  **glass-block band** between the canopy and the first-floor sills.

The plan's sketch needs correcting in three places:
- The two-bay erker is rare. Only 4 pands have stacked multi-bay oriels (40,
  35, 144 and the 1913 no. 4).
- The common projection is a one-bay **shallow box frame** with a hood over
  one window per house. It is on 40 pands.
- There is no pyramid cap on any street front. The corner and end masses rise
  as flat-topped brick towers.

Bodies (counts over the 148 survey pands):

| body | count | where | exemplars (pand id) | kit status |
|---|---|---|---|---|
| **lintel-band** (`evertsen-1925-school-banded`): continuous projecting white sill and head bands on every storey; triple windows; red brick (yellow-brick piers between windows on the even side); low parapet; rigid canopy with signs on the fascia, no glass block | 18 | 9–33 odd (12), 24–38 even (6) | 13 (071876), 23 (081449), 32 (128497) | `bands: "courses"` + `windowHoods` approximate it; needs a **continuous projecting sill/head band in white** (painted bands from the Nassaukade lane) and **two-tone brick piers** |
| **hood-lisene** (`evertsen-1925-school-erker` as the plan called it): dark brown brick; per house one shallow box-framed bay with a hood, the other windows plain paired casements; brick lisenes at the house divisions; glass-block band; rigid canopy; tall plain parapet | 40 | 93–129 odd (17), 96–140 even (23) | 101 (147193), 118 (081416), 126 (118917) | lisenes, window hoods, glass-block band and rigid canopy exist; missing: the **single-bay shallow box bay** (0.2–0.3 m, hood on top, no stallriser) and **side-hung casements with a fixed top light** |
| **balcony-slot** (`evertsen-1927-school-balcony`): plain dark brown; per house a French door with a small slab balconette and a projecting hood slab, stacked over three storeys; paired casements; glass-block band; canopy; tall parapet | 14 | 59–87 odd | 61 (107408), 69 (080856), 81 (110182) | needs a **stacked balconette with hood slab** (per-storey slab + rail) |
| **ladder / small-pane plain** (`evertsen-1925-school-plain`): plain brown brick; paired windows with gridded small-pane top lights (ladder lights on 43–53); tall plain parapet; glass-block band; canopy | 19 | 45–53 odd (5), 52–64 even (5), 68–90 even (9) | 49 (127935), 60 (124819), 70 (079120) | ladder windows exist; the small-pane **top-light grid** over a casement is missing |
| **1926–27 west of the plein, tile roof** (`evertsen-1926-white-attic`): brick, three storeys, a white-painted continuous window band as top storey under a tiled pitched roof, a brick balcony band over the ground floor, residential ground with paired doors, raised stair towers at the ends | 12 | 139–149 odd, 146–156 even | 141 (151275), 148 (093776), 154 (130972) | a **white attic band** (glazed continuous storey in painted timber) and **brick balcony band** are missing; the pitched tile roof exists |
| 1939 infill with dormers | 5 (+162 no front) | 151–155, 158–160 | 151 (138602), 155 (131504), 160 (065375) | ordinary kit; wide 3-light windows, box dormers (`dormerStyle: "box"`) |
| corner and end masses | 16 | 20–24, 35, 31–37, 39, 41, 40, 42, 44, 43, 55, 57, 66, 89, 91, 92, 94 | 40 (089629), 35 (147692), 66 (131498) | see the large table; most need a raised flat-topped mass over the parapet, several need stacked oriels |
| other Amsterdam School singles | 4 | 133–135 (plain red brick, no canopy), 137 (side wall), 142 (plain three-storey), 144 (tower) | – | ordinary kit / bespoke (144) |
| 1910s | 6 | 1–16 | 4 (138628), 7 (159654), 10–12 (148911) | Oud-West types |
| post-war | 13 | 18, 164, 171–781 | – | large / ordinary |

Crowns:

| crown | count | exemplars | note |
|---|---|---|---|
| **parapet** (tall plain brick parapet with thin coping, no cornice) | 91 | 13, 69, 126 | the street's crown; the kit needs a **tall parapet zone** (2–3 m of plain wall over the top heads) |
| **raised corner mass / corner tower, flat top** | 7 | 40 (tower), 20–24 (round), 66 | the plan's "tower-pyramid-corner": `tower.corner` with `cap: flat`; no pyramid caps on these fronts |
| **raised stair-tower end** (the plan's "raised-centre", which actually sits at row ends) | 7 | 55, 145, 150 (also 57, 143, 152, 155) | a narrow brick mass 3–5 m over the eaves with one small window per storey |
| **pitched tile roof over a white attic band** | 13 | 141, 148, 154 (dormers on 151, 153, 158, 160) | west of the plein only |
| stepped corner | 2 | 91, 7 | brick piers stepping down to the eaves |

Components and counts:
- rigid canopy: about 95 pands (every body except the tile-roof rows, the
  1910s and the post-war)
- glass-block band: 73 (hood-lisene, balcony-slot, ladder)
- lintel bands: 18, plus the corner group 35–44
- dark plinth brick: not seen as a separate course. The shop zone is
  canopy, glass block and fascia.
- ladder windows: 5 clearly (43–53), 14 more with small-pane top lights
- two-bay erker: 3 Amsterdam School + 1 1910s
- shallow single-bay box frame with hood: 40
- lisenes: 40 (hood-lisene rows)
- stacked balconettes: 14

What the kit still cannot say on this street (for the type-library lane):
- side-hung casements with a fixed top light, which is the dominant window
- the tall plain parapet zone with a thin coping
- the single-bay shallow box frame with a hood
- stacked balconettes with hood slabs
- white continuous sill and head bands with two-tone brick piers
- the small-pane top-light grid
- the white attic band under a tile roof, and the brick balcony band
- signs mounted on the glass-block band
- the corner group's diamond-brick frieze and cast-iron balustrade
- stacked half-round and pointed oriels (40, 144)
- the clock tower and the gateway arch (bespoke)
