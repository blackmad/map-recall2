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
