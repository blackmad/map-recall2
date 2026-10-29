# Kit gaps

What the large kit cannot yet say, collected by factory review turns, with how many reviewed pands each blocks. One opus kit session a week takes the top two.

## Factory batch 1, round 2 (2026-10-24)

| Gap | Pands blocked | Example |
|---|---|---|
| Deep loggias / recessed balconies on a brick grid | 2 | OBA IJburg walls[2,3] |
| Glazed ground floor / plinth band under a punched grid | 3 | OBA IJburg, Reigersbos, Buitenveldert walls[3] |
| White or grey panel facade with glass bays | 2 | Spinoza20first walls[0,6] |
| Painted-black brick over a shopfront sign band | 1 | OBA Molenwijk walls[0] |
| Glass-block stair tower | 1 | OBA Reigersbos walls[4] |
| Glazed columns through storey lines (needs hand bays) | 2 | pand-087570, pand-243823 |

Measurement gaps (not kit): bare branches count as glazing in the likeness mask; a shaded crop sets an inherited colour too dark (Geuzenveld tower); a sign band is measured as wall (Molenwijk).

## Factory batch 2 (2026-10-24, pre-1920 by BAG year)

| Gap | Pands blocked | Example |
|---|---|---|
| A row of separate houses on one pand drawn as one flat block (per-house heights, gables) | 2 | pand-165427, Stadhouderskade 111 |
| White stone bands, oriels and arch heads on dark brick | 3 | Damrak 77, pand-233585, Hirschpassage 2 |
| Vertical window bands (piers between continuous glazing) | 1 | pand-236656 |
| Horizontal metal cladding on halls | 1 | pand-083151 |

The BAG year filter let four modern buildings into a "pre-1920" batch; the batch selector needs a better era signal.

## Landmark kits (review 1)

Review of kit sheets 1–10 (40 kits, `kit-sheets-20261024/artifacts/strips/kits-1..10.png`), opus, 2026-10-24.
2 pass, 38 hold (6 no photo). Verdicts in `public/canal-drive/landmark-reviews.json`.

| Defect | Kits | Sheet rows |
| --- | --- | --- |
| Generic school wall is one flat beige/tan whatever the photo shows; photo is red/brown brick in 10, glass/concrete/white bands in 5, none matched beige | 16 | 1 2 8 9 10 12 18 20 23 24 25 27 33 34 35 40 |
| Uniform grid of small square punched windows where the photo has horizontal ribbon/strip glazing, large white- or coloured-frame window groups or curtain wall | 13 | 8 12 15 18 20 23 33 34 37 38 39 40 (+16/32 passed despite it) |
| Kit renders 0 tris: generic cinema/church/temple draw nothing, only the host extrusion | 6 | 5 6 7 13 21 30 |
| Flat roof where the photo shows a tiled pitched/hipped roof with dormers or chimneys (pre-war schools) | 3 (+1 in a 0-tris kit) | 3 14 19 (5) |
| Red-brick school variant is a bright orange-red; photos are darker brown brick, Amsterdam School banding (white top band, rows of narrow windows) or white arched surrounds | 3 | 37 38 39 |
| Worship kits always red brick + round-arched windows; photos are buff/yellow brick (26) or a modernist near-blank brown block (31) | 2 | 26 31 |
| Sheet photo unusable (vegetation only, or a neighbouring house) | 2 | 9 29 |
| No photo / unresolved pand | 6 | 4 11 17 22 28 36 |

Top fixes for the kit session: (1) school wall colour from the photo/BAG era instead of a fixed beige, with a brown-brick default for pre-1970 schools; (2) a ribbon-window / large-glazing facade option for post-war schools; (3) cinema/church/temple kits with no geometry (0 tris) must fall back to a massing or not be listed.

## Large kit row split (#30, 2026-10-24)

`walls[].houses` (rowSplit.ts) draws a row of houses on one pand: width, eaves, storeys, bays, window shape, crown (cornice | flat | gable) and colour per house. Proven by hand on `pand-165427` and `stadhouderskade-111-137448` (measure.ts proposes joints only on a ΔE76 ≥ 20 colour change, or a weaker one on a ≥ 1.5 m 3DBAG roof step; it found 5 of the 9 Stadhouderskade joints). Still cannot say:
- step / neck / bell gable crowns per house (only cornice, flat, or the 3DBAG gable wall);
- removing the 3DBAG gable triangles above a cornice crown (set-back roofs and dormers);
- pilaster strips between houses;
- white window surrounds, string courses and balconies per house;
- a brick corbel cornice; arched top-storey windows and an oculus (pand-165427).
Measurement gap: white-framed windows count as trim, so photo glazing reads low (Stadhouderskade 0.21 vs model 0.38).

## Large kit stone dressings (#31, 2026-10-24)

`walls[].dressings` (blockBuilding/dressings.ts, validator stoneDressingsIntent.ts): bands (floor/sill/head, double), speklagen stripes, heads (lintel/keystone), eared surrounds, quoins, canted/square oriels, voussoirs with jambs, piers, own colour slot. `lightBands.ts` proposes bands only when a light row repeats in ≥ 2 storeys (found none on Damrak 77, pand-233585, Hirschpassage 2: Damrak's oriels make every row half light). All three re-authored and held. Still cannot say:
- one opening spanning several bays (Damrak's 6 m Beurspassage arch);
- a bay grid offset from the panel edge;
- brick corbel tables; attic windows under hoods in the roof zone (pand-233585);
- a window shape per storey; glazing on oriel cheeks; narrow ground openings;
- balcony rails in their own colour (black iron reads white);
- fluted giant pilasters with capitals, balustrades (Hirschpassage).
Damrak's brick renders too orange beside the photo after the game tint (#6a3a2a → #8b4c37); review before install.

## Large kit giant order (#35, 2026-10-24)

Added: `dressings.piers` `to/deep/capital/base/flutes/stone/ends`, `dressings.corbels` (corbel tables broken by piers), `walls[].windowGroup` (2–4 windows per bay), `balconies.colour/deep/windows` (rails in their own slot, so iron reads black). Eaves gate fixed on pand-233585 and pand-165427 by dropping sliver/set-back surfaces with evidence in each house's notes. None of the five held houses passes yet. Still cannot say:
- capitals on separate 3DBAG pilaster facets; balustrades; open ironwork (rails are a solid sheet);
- the small arches of a corbel table; brick pier capitals; brick-on-brick relief does not read without a colour change;
- a window shape per storey; mixed 2+1+2 groups per bay;
- Stadhouderskade's red segmental heads and rendered risalit within 12k triangles; three windows per bay on every Hirschpassage facet (~3k over budget);
- Damrak: one opening across several bays, an offset bay grid.
Measurement: the likeness grid merges paired windows into one column and reads a dark frieze or dark sandstone as glazing.

## Kit review round 4 (2026-10-24)

Sheets `kits-r5-*.png`, verdicts in `landmark-reviews.json` round 4 (row
numbers are sheet rows). Regressions from #36/#37/#41 measurement:
- Window placer has no blank-wall guard: 220, 279, 356, 421 (blank brick or
  panels now carry window grids); 5, 23, 67, 125, 127, 153 near-blank halls.
- Glazing goes to ribbons on punched-window brick schools: 109, 166, 200, 240.
- LoD2.2 hipped roof wins over a flat parapet street front: 142, 150, 157,
  160, 161 (pyramid taller than the walls), 172, 178, 188, 205; the reverse
  on 70, 78, 98.
- Windowless boxes: 54, 65, 93, 94, 108.
- 316 (pand 0363100012079990): 0 triangles, renders as a 30 m pillar.
- One pand, five OSM ways in different colours: 42–46.
Still not expressible: curtain walls, sawtooth/folded/parabolic roofs, metal
rib or louvre cladding, timber slats, ridge turrets and bell towers, drum
churches, stepped gables on schools, arched heads in the school kit, mosque
portals and pointed arches, pilotis, external stair galleries.

## Ride-visible large tier (#105, 2026-10-29)

17 drafted from the #104 ranks 1–40, 0 installed. Blockers by count, from `docs/handoffs/ride-landmarks-20261029.md`:

| Gap | Pands blocked | Example |
|---|---|---|
| Curtain wall judged as "wall not drawn, glazing 1.00" (judge, not kit; #112) | 5 | NFTA, AkzoNobel tower, Apollo, Pieter Nieuwland walls[3], Het Dok walls[5] |
| Crop pairs to single 3DBAG facets, misses curved/stepped fronts (measurement) | 3 | Het Nieuwe Huis 6 of 8 groups, Sarphati Plaza 5 of 8, AkzoNobel 8 of 8 |
| Crops stop at 32 m, towers have no upper-storey evidence (measurement) | 3 | Het Dok, AkzoNobel tower, Atrium |
| Translucent channel glass with scattered clear windows in a wide concrete frame | 1 | NFTA |
| Cantilevered slab balconies and ribbon parapets | 1 | Sint-Nicolaaslyceum |
| Graffiti / mural front | 1 | Y-Helling |
| Warehouse with a modern block on top as one pand (BAG footprint differs from the LoD2.2 shell) | 1 | Pakhuis Australië |
| Pand not in the building tiles | 2 | Prins en Keizer 165685, Belastingdienst 107557 |

Identity noise in the ranked list (not kit): one office drawn by four OSM parts, an underground station, a name merge of two buildings, a twin BAG registration of a modelled house. Triage (#110) removes these before any draft.

## Triage over the whole queue (#110, 2026-10-29)

`scripts/landmarks/triage.ts` over 336 candidates (324 queue rows plus the #104 targets): buildable 32, kit-gap 117, no-evidence 140, not-in-tiles 21, covered 8, bespoke 18. Validation against the 45 reviewed houses: 42 predicted. Full rows in `docs/reports/landmark-triage-20261029.json`.

| Gap | Candidates | Examples |
|---|---|---|
| Tower above the 32 m crop cap (measurement, `rectify.ts wallHeight`; #114 parametrises it) | 95 | OBA Geuzenveld, OBA Postjesweg, Atrium 244160, AkzoNobel 240015/240149, Pakhuis Australië, Sarphati Plaza, The Edge, Het Dok, Atlanta, Byzantium 236811 |
| Curtain-wall street front (judge; #114) | 19 | OBA IJburg, Molenwijk, Reigersbos, Slotermeer, Kalverpassage, Loods 6, Forum |
| Blank wide street front (cladding or mural; not detected separately) | 8 | Forum 125840, 080532, 119400, 242116, 240481, 237888, 095940, 239598 |

Triage cannot yet tell cladding, mural and channel-glass fronts apart: the measured wall families are brick, paint and stone only. Y-Helling reads `curtain` but is a graffiti mural. Factory pairing ignores better `L`/`R` alternate crops (OBA Buitenveldert 135359 has judgeable 2022 crops the factory never used).
