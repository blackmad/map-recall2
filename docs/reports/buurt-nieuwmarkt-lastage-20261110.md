# Nieuwmarkt/Lastage: Waterloopleinbuurt (AF09), Zuiderkerkbuurt (AF08), Nieuwmarkt (AF05), Rapenburg (AF04), 2026-11-10

Lane `lane/belt-nieuwmarkt-lastage-20261110`, MODEL: opus. Installed: **2 pands** (Rapenburg 97 and 99, run `rapenburg-89-103-r1`).
Sheets and strips: `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/nieuwmarkt-lastage-20261110/`
(`sheet-rapenburg-89-103-r1.png`, `strip-<face>.png` for every intaken face).

## Census (survey, BAG pands; register = `monument-facts.json`)

| buurt | pands | by 1945 | register | register gables | 1970-99 infill |
|---|---|---|---|---|---|
| AF09 Waterloopleinbuurt | 111 | 77 | 31 | cornice 12, bell 6, neck 6 | 17 (Jodenbreestraat, Waterlooplein) |
| AF08 Zuiderkerkbuurt | 279 | 225 | 105 | cornice 48, bell 18, plain 15, neck 14 | 37 (Verversstraat 10, Nieuwe Hoogstraat 6, Zwanenburgwal 6) |
| AF05 Nieuwmarkt | 233 | 176 | 78 | cornice 25, plain 20, bell 15, neck 11, step 1 | 54 (Recht/Krom Boomssloot 13, Keizers(dwars)straat 11, Snoekjesgracht 5) |
| AF04 Rapenburg | 125 | 88 | 28 | cornice 17 | 24 (Rapenburg 21, Prins Hendrikkade 6) |

* **BAG 1905 is a placeholder** on 109 pands (Zuiderkerk 43 vs 3 in 1900-04; Nieuwmarkt 49). New typed guard
  `match.unknownYears` (autoPlace.ts, test `nieuwmarktLastage.test.ts`, absent = byte-identical): a listed year neither passes
  nor vetoes. Both lane types list 1905.
* 240 proposed faces, 128 with two or more pands (626 pands). Intake so far: 23 faces (Rapenburg all except 75-87; the first
  Groenburgwal, Boomssloot, Jodenbreestraat faces). The rest is still running or not started (see integrator notes).
* The strips confirm the addendum: one design per pand, almost never a repeated row (Foeliedwarsstraat 40-88, Groenburgwal 2-30,
  Rapenburg 1-19 and 46-80 each show 5-11 different fronts). The 1981 renewal houses (Rapenburg 22-38) share a grammar
  (red-brown brick, one off-centre axis of cream-framed windows at split levels, a cream top band with a window ribbon, a cream
  entrance box) but the half-storey stagger between neighbours and the entrance box are not expressible; no type yet.

## Types (`scripts/block-face/types/nieuwmarkt/`)

* `lastage-cornice-house` (Rapenburg 97, gridded crop of the 2024-12-10 strip): white-painted ground storey 0-4.3 m as a `pui`
  ground front (door, wide window, door), three axes of white sashes (4.5-6.6 / 7.4-9.4 / 10.1-11.6 m), dark brown brick to 12.5 m,
  white attic frieze + cornice to 14.7 m (top storey carries the `frieze` cornice). Crowns frieze / dormer / none.
* `lastage-bell-house` (Rapenburg 99): white ground storey 0-4.8 m, three axes of small-pane windows 1.1 x 1.5 m, bell/neck gable
  12.4-15.0 m with one attic light. Derived from `jordaan-1750-neck-gable`.

## Yield (all intaken faces auto-placed with the library)

| outcome | pands |
|---|---|
| vetoed before comparison (year, frontage, every type) | most; the 9-15 m double fronts and post-1925 infill |
| compared and held (score < 0.7: tree skylines read crown rises of 6-11 m on Groenburgwal; likeness; run of one) | most of the rest |
| held by the lane (`rapenburg-review-holds.json`, `zuiderkerkbuurt-review-holds.json`) | 4 (Rapenburg 93, 95; Groenburgwal 2A, 4) |
| **placed and installed** | **2** (Rapenburg 97, 99) |

Totals by `-placement.json`: rapenburg 2/7, zuiderkerkbuurt 2/22 (both held now), nieuwmarkt 0/19, waterloopleinbuurt 0/13.

### What the Rapenburg 97-99 install needed (lane pins, the Opus review must confirm)
* `rapenburg-review-types.json`: 97 cornice house (edge NCC preferred the bell type on the window rows alone), 99 bell house.
* `rapenburg-review-eaves.json`: 97 at 14.7 m (cornice top; 3DBAG 11.6 m), 99 at 12.4 m (gable foot; 3DBAG 11.3 m).
* `rapenburg-review-accepts.json`: 97 floor 0.08, because the dark brick reads olive on the grey day and the likeness counted it as
  foliage (31 %), with no tree in front.
* Run intent edits: 99's shopfront white (the measured #3c3f36 was the glass), both bricks lowered (#3f342b, #3b2e25) so the render
  meets the photo wall (sheet: 99 ok, 97 hue -14 deg).
* Sheet by eye: window rows, white grounds and the bell outline line up. 97's second-storey windows are about 0.6 m short at the
  head (the 0.4 headLine floor of the top storey stops the split that would fix it). 97's sashes are drawn four-pane where the photo
  shows two-light sashes. 99's gable is a little wide at the shoulders. Its left house door stands in brick outside the white pui.

## Kit cannot yet say
* split-level (half-storey staggered) window axes between 1980s renewal neighbours, and their cream entrance boxes;
* the panelled attic frieze with a dormer over a two-window-storey cornice house (Rapenburg 95);
* white speklagen and block quoins on step and neck gables (Groenburgwal 2A, Nieuwmarkt 20-22; the register verdict already lists this);
* the white-painted ground storey that includes the house door (99): the residential door of a shopfront stands in brick;
* a top-storey window head under 0.4 of a storey that also carries a frieze;
* two bell fronts in one BAG pand (Rapenburg 5-7) need `modules` placement, not automated.

## Pipeline notes
* On tree-lined grachten (Groenburgwal, 2025-01-08 strips), the skyline reads bare branches as crown rises of 6-11 m.
  Every type is then held at score < 0.7, so these faces need crown pins or summer strips.
* `rapenburg-75-87` (seven 1981 houses at 4.2 m) fails intake: the sightline to Rapenburg crosses pand 181607 for every seed.
* `roof-golden.ts` reports 0 violations; `--write` would add about 280 other lanes' faces as well, so I did not write it.

## Checks
`npm run test:block-face` 337/337, `npm run lint` clean (before the report commit).
