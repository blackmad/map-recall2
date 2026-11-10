# Landlust-Zuid (EE06), 2026-11-10

Lane `lane/buurt-landlust-20261110`, MODEL: opus-class authoring by a sonnet lane. Nothing installed. Sheets and strips:
`/Users/blackmad/Code/map-recall2-source-data/block-face-strips/landlust-20261110/` (`strip-<face>.jpg`, `sheet-<run>.png`, 34 run sheets).

## Survey

478 pands by BAG units (469 built by 1945), 54 proposed faces, library before this lane: none. Intake ran for the 36 faces of 4+ pands
(332 pands, coverage 1.0 on every face, 2021-2025 panoramas); the other 146 pands are single-pand and short faces.

Families by design, read off the strips (the year band is not the design):

| design | faces | pands | type |
|---|---|---|---|
| Bestevaerstraat 1923-26: yellow-brown stair blocks, glass-brick pilasters, dark plinth with arched doors | bestever-* (6 faces) | ~110 | `landlust-1924-bestevaer-stair-block` (12 m pands), `landlust-1924-bestevaer-half-block` (6 m) |
| Callenburgstraat 2-63, Haenstraat 3-31, Andringastraat: red-brick 12.8 m slot blocks, three storeys | callenburg-*, haen-3-31, andringa-* | ~60 | `landlust-1934-slot-block` |
| Haenstraat 6-62, Zwijgerlaan 225-279: the same design with a fourth storey | haen-6-62, zwijgerlaan-225-279 | ~25 | `landlust-1935-slot-block-four` |
| Treslongstraat 5-59 (1933): erker + window, tile roof, three storeys | treslong-5-59 | 16 | `landlust-1933-erker-window` |
| Coppelstock 29-49, Haringstraat 13-27: three equal windows, tile roof, three storeys | coppelstock-25-55, haring-13-27 | ~18 | `landlust-1933-three-axis-tile` |
| Haringstraat 1-11: the same front, four storeys | haring-1-11 | 6 | `landlust-1937-three-axis-four` |
| Leijnsenstraat 2-30, Haringstraat 26-38 (1934): three-window tile-roof fronts | leijnsen-2-30, haring-26-38 | 22 | `landlust-1934-tile-pair` |
| Haringstraat 6-18 (1938): wide + narrow pair, attic ribbon, white slab | haring-6-18 | 7 | `landlust-1938-ribbon-attic` |
| Leijnsenstraat 11-31, Treslong 6-20, Zwijgerlaan 185-195: same body, two attic windows | leijnsen-3-31, treslong-6-26, zwijgerlaan-183-195 | ~21 | `landlust-1938-pair-attic` |
| Treslongstraat 30-52 (1937): erker + attic, five storeys | treslong-30-62 | 10 | `landlust-1937-erker-attic` (placed 0: the run does not compile, see below) |
| One-offs / no type: Ruijterweg (Amsterdam School bays and balconies), Rijpgracht (four storeys, attic dormers), Galenstraat shop fronts, Vries 1-23 (8 m slot variant), Doorman, Zwijgerlaan 161-219 (scaffolded or other), Coppelstock 8-56 | | ~150 | none |

## Yield (332 intaken pands)

| outcome | pands |
|---|---|
| vetoed before comparison: every type vetoed on year / frontage / storeys / eaves / balconies | 90 |
| vetoed before comparison: strip evidence gate (trees, scaffolding, void) | 13 |
| compared and held: best type under 0.7 | 36 |
| compared and held: likeness gate or run did not compile | 25 |
| compared and held: run of one between held neighbours | 18 |
| compared and held: lane review (a type was matched on year and eaves but the layout is another design) | 39 |
| **placed (compiled, gates pass, sheet exists)** | **111** |

Placed by type: slot-block 20, erker-window 16, half-block 16, stair-block 15, tile-pair 12, three-axis-tile 11, pair-attic 8, slot-block-four 6, ribbon-attic 5, three-axis-four 2.

Compile holds: `treslong-30-62` runs over Treslongstraat 30-48 fail with "Grouped frontage is not a straight surveyed wall" (the street bends there).
`landlust-1937-erker-attic` therefore placed nothing; the type is authored and pinned but unproven on a straight run.

## What the lane reviewed and held itself

The first buurt-wide run put types on faces they do not describe (erker-window on four-storey Rijpgracht and the Galenstraat shop fronts,
tile-pair and erker types on bestever and leijnsen pands on near-tie edge NCC through trees). The fix is in `buurten/landlust-zuid-review-types.json`
(face pins, 17) and `landlust-zuid-review-holds.json` (37 pands). The Opus review should confirm or amend them.

## Cast and colour

The Bestevaerstraat strips (2024-11-21) carry a yellow cast: the window frames read #d0ceaf, so blue x1.19 to neutral turns the raw wall
#8b7a59 into about #8b7a6a. The type default uses that corrected value; each placed pand takes its own trim-normalised wall. Placed model walls
still read 0.10-0.16 lighter than the photo on most red-brick runs (the sheet's "too light" flag); that is the brightening policy, not a fit.

## Kit cannot yet express

* a dark brick plinth storey with an arched stair door (Bestevaerstraat): drawn as a banded ground with a rectangular door;
* glass-brick pilasters at the party walls (drawn as a plain `lisenes` half pier);
* tall slot lights running through two storeys (Callenburg, Haen, Zwijgerlaan): drawn as one narrow window per storey;
* four doors in two pairs under one flat canopy (slot blocks): one door and a window are drawn; the canopy is not drawn;
* box dormers (zinc, 2.2 m) on flat-roofline slot blocks and tile-roof fronts: not drawn; the roof is flat or a plain saddle;
* the canted erker is a square box bay;
* a bay window over a shop ground floor (Galenstraat, Rijpgracht) with an erker row: no type;
* an arched door head with three ground windows (Rijpgracht 14-24).

## Integrator notes

* `scripts/block-face/buurt-families.ts` and `scripts/block-face/grid-crop.ts` are the Indische lane's tools, copied in from `lane/buurt-indische-20261110`
  (identical blobs); drop either copy at merge.
* New library `scripts/block-face/types/landlust/` (10 types), `buurten/landlust-zuid*.json`, face run dirs under `scripts/block-face/faces/` (25 MB).
* `npm run test:block-face` 303/303. No browser run, no bundle touched.
