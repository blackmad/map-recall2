# Design units, phase 0 gate (2026-11-19)

Plan: `docs/handoffs/design-units-plan-20261119.md`. Handoff: `docs/handoffs/design-units-handoff-20261119.md`.

**Verdict: the premise holds in part, and I stopped before phase 1.**

- The layers cover the ring: 86% of non-minor ring pands sit inside an ordekaart object.
- The "Basis" polygons are ordinary buildings, not merged blocks.
- All four regression rows regroup correctly.

What does not hold is the drawing rule phase 1 would apply: one elevation, one eaves line and one roof per object.

- **Gordel (1920–40) objects are composed blocks.** One architect's block has 4-storey sides and 5-storey corner accents. In 39% of the units that hold published rows, the look David liked draws the members as different designs. Most of that is explained by a measured height step.
- **Centrum objects are sometimes heritage complexes.** Some hold several separate houses. Three spot checks found two visibly different designs in one object.

Phase 1 as written would flatten the liked Plan Zuid blocks and merge distinct old houses. That is more than "a small share", and it changes the approved plan, so the next step is David's (see the end).

## What was built

- `src/canalRecall/designUnits/`: `types.ts`, `join.ts`, `regressionRows.ts`, and `designUnits.test.ts` with a fixture cut from real data (`fixtures/regression-rows.json`, 398 pands, 117 objects).
  - Run the tests with `npm run test:design-units`.
- `scripts/design-units/build-index.ts` builds the ring join and stages the index.
- `scripts/design-units/controls.ts` runs the positive controls.
- `scripts/design-units/make-fixture.ts` cuts the test fixture.
- **Archive.** The four layers, the terms text and checksums are in map-recall2-source-data `datasets/ordekaart-20261119/` (source-data b7695c3e, fetched 2026-11-19T15:16:52Z). The staged index, stats and controls are archived beside them, so nothing depends on this session's untracked `artifacts/`.
- **Licence.** Maps Data Gebruiksvoorwaarden: any lawful use, commercial included; attribution appreciated, not required; a redistributed copy must say the original is free from the Gemeente under these terms. The CKAN mirror says "License not specified".
- **Not published.** `public/data/extracts/amsterdam/design-units-v1/` was not written. The index stays staged until the drawing rule is settled.

### Join rules (measured, in `join.ts`)

- **Assignment.** A pand joins the object holding at least 50% of its footprint area. Share histogram of the best object over non-minor pands, in tenths:

  | Share | 0–.1 | .1–.2 | .2–.3 | .3–.4 | .4–.5 | .5–.6 | .6–.7 | .7–.8 | .8–.9 | .9–1 | 1 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | Pands | 5,819 | 83 | 157 | 254 | 551 | 828 | 1,081 | 1,825 | 3,159 | 35,158 | 471 |

  The distribution is cleanly bimodal; moving the threshold between 0.4 and 0.6 moves about 1,400 pands (3%).
- **Straddles.** A pand straddles when a second object holds at least 20%; there are 424. Objects that hold at least 10% of a pand they do not get: 2,102.
- **BAG wins.** 71 pands built after 2015 were kept out of objects.
- **Year check.** Where the object carries a year, the pand's BAG year matches it exactly for 83.5% and within 2 years for 96.1%. Only 447 pands differ by more than 15 years; those units carry the flag `bag-year-differs`.
- **Inferred units.** Uncovered, non-minor party-wall neighbours with the same BAG year, eaves within 0.3 m and the same 3DBAG roof class join one inferred unit. This rule is deliberately strict: 575 inferred units, and everything else is a single.
- **Fronts.** Fronts come from `buurtGenerator/rows.ts frontEdgeOf`. Members are ordered left to right along each street, with from/to metres.
  - 2,377 units are corners (two faces).
  - 10,861 units have a member with no street front (rear wings).
  - Units whose face run has another building in it are flagged `face-gap`.
- **Seeds.** A single-pand unit seeds on its pand id, byte-identical to today.
- **Family key.** Architect number, object year and module (the median member front, to 0.5 m). Multi-pand units with a known architect fall into 3,121 families.

## Gate numbers

### Ring and coverage

- **The ring.** 198 buurten, 59,565 pands, of which 10,179 are minor and 49,386 non-minor.
  - Coverage-v1 counts 60,015 pands. The 0.75% gap comes from this script locating pands against the simplified published buurt outlines.
- **In an ordekaart object:** 42,460 of 49,386 non-minor pands (86.0%).
  - By layer: Gordel 14,406, Ring 13,881, Centrum 7,704, AUP 224.

| Gebied | Non-minor pands | In an object | Share |
|---|---|---|---|
| Oud-Zuid | 9,037 | 8,456 | 93.6% |
| Oud-West, De Baarsjes | 9,072 | 8,447 | 93.1% |
| De Pijp, Rivierenbuurt | 8,526 | 7,862 | 92.2% |
| Centrum-West | 8,612 | 6,887 | 80.0% |
| Centrum-Oost | 6,435 | 5,126 | 79.7% |
| Westerpark | 4,088 | 3,022 | 73.9% |
| Oud-Oost | 3,616 | 2,660 | 73.6% |

40 of 198 buurten are under two thirds. The worst are business parks and new-build areas the layers never covered: Houthavens-West, Isolatorbuurt, Contactbuurt, Marcanti, Bedrijventerrein Schinkel and Marine-Etablissement. Per-buurt numbers are in the archived `staged-stats-20261119.json`.

### Units

- **Totals.** 28,376 units: 12,830 ordekaart, 575 inferred, 14,971 singles.
  - 7,105 units hold more than one pand, 38,294 pands between them.
  - The plan guessed about 15,000 units. The difference is mostly singles: 6,300 one-pand objects and 14,971 uncovered pands.
- **Pands per ordekaart unit:**

  | Pands | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10+ |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Units | 6,300 | 2,076 | 1,123 | 853 | 468 | 461 | 282 | 253 | 174 | 840 |

  234 units have 20 or more members (7,160 pands): 181 of them Gordel, 27 Ring, 21 Centrum, 5 AUP.

### Units by Orde, and what Basis is

Areas are in m² and are medians. Pands per object counts objects inside the ring only.

| Layer/Orde | Objects | Area | Pands per object (median / p90 / max) |
|---|---|---|---|
| Centrum 1 / 2 / 3 | 3,974 / 2,403 / 1,155 | 116 / 83 / 85 | 1 / 4 / 41 · 1 / 3 / 30 · 1 / 2 / 14 |
| Ring 1 / 2 / 3 | 571 / 683 / 2,939 | 309 / 207 / 227 | 1 / 5 / 40 · 2 / 6 / 35 · 3 / 7 / 60 |
| **Ring Basis** | 1,238 | 237 | 3 / 7 / 27 |
| Gordel 1 / 2 / 3 | 544 / 353 / 1,074 | 685 / 489 / 626 | 5 / 25 / 98 · 6 / 19 / 44 · 6 / 20 / 78 |
| **Gordel Basis** | 1,035 | 412 | 6 / 16 / 53 |

**Basis polygons are not merged blocks.** In both layers they are the same size as order-3 objects, or smaller. The large objects are Gordel orders 1–3: whole composed blocks by one architect, which is how the 1920–40 layer was drawn. AUP barely reaches the ring (224 pands).

### Agreement with groupings we trust

1. **Published rows David liked** (Rivierenbuurt, Apollo/Stadion, Kinkerstraat; 4,177 records, 4,123 inside an object). This is the positive control.
   - **Units:** 480 units hold two or more records. 335 of them span more than one published series. In 188 of them (39%, holding 2,084 of 4,079 pands, 51%), the look draws the members as different designs: storeys, crown, or an eaves step over 0.8 m. All 188 are Gordel objects.
   - **Pairs:** of 25,973 pairs of members sharing a unit, 18,454 (71%) agree. Of the 7,519 that disagree, 3DBAG measures an eaves step over 1.5 m for 5,583 (74%) and 0.8–1.5 m for 814 (11%). Only 1,122 (15%) have no height step.
   - **With a measured-step rule:** if units were split at measured eaves steps over 0.8 m, 85 of the 480 units (18%) would still disagree.
   - **Series:** 881 series with two or more members lie wholly in objects. 713 sit in one unit; 29 span units of one architect and year (a repeated design, consistent); 139 span units by different architects. In those 139 the liked look drew several architects' blocks as one series.
2. **Face intents.** Groups that fall in one unit:

   | Field | In one unit |
   |---|---|
   | `identical` | 5 / 5 |
   | `sameAs` | 19 / 21 |
   | `corniceGroups` | 18 / 23 (one more is the same family) |
   | Together | 42 / 49 |

3. **Centrum lane's photo-confirmed same-building runs** (opus reads at confidence 0.6 or above, `lane/centrum-looks-20261115` 73b8dd3cc).
   - **"one" runs:** 49, and 45 of them (92%) share a unit.
   - **"separate" runs:** 60, and only 14 are split. 46 share one ordekaart object, 44 of them with no measured height step.
   - **Spot checks** (my own reads of the lane's cuts, three runs):

     | Pands | Object | What the photo shows |
     |---|---|---|
     | 172855/172856 | centrum:6651 | Two 17th-century houses with different gables: separate |
     | 168959/168960 | centrum:6161 | A plain gabled house beside an ornamented 19th-century front: separate |
     | 174113–174293 | centrum:6188 | One run, alternating front designs under aligned cornices: a designed ensemble, not one elevation |

     This is three runs only. It shows that Centrum objects can be heritage complexes. It does not measure how often.

4. **Regression rows.** All four pass as unit tests.

   | Row | Objects | Members pinned |
   |---|---|---|
   | Marnixplein | centrum:6588 | 3 + 1 |
   | Goudsbloemstraat | centrum:22 | 7 + 1 |
   | Rustenburgerstraat | ring:8276 / 8275 / 8274 | 3 / 2 / 1 + 3 |
   | Van Ostadestraat | ring:8815 / 8794 / 8792 / 8793 | 2 + 5 / 2 / 2 / 4 |

   The "+ n" are same-object, same-year, full-height pands outside the photographed run (corner and side faces) that the area join found. They are pinned in `regressionRows.ts` as `found`. Marnixplein's face has an 11.5 m gap between 174907 and 174906, flagged `face-gap`.

## Why I stopped

The brief said to stop if the ordekaart grouping contradicts the liked series on more than a small share.

- **Gordel.** On the unit-level measure it does: 39% of the units holding liked records, and 51% of their pands.
- **Centrum.** The "separate" reads point the same way: 46 of 60 are merged into one object.

Most of the Gordel disagreement is not a wrong grouping. These blocks really are one architect's composition. But phase 1 would draw them with one eaves line and one roof, and that would erase the height accents David approved. In the Centrum, the spot checks show the object can hold distinct houses, and one unit seed and one wall family would make them alike.

**This is not borderline on the numbers, and the fix changes the approved plan.** That is David's call, not mine. No lanes were spawned.

## Options for David (issue to follow)

**A. Units as identity, elevations in segments (my recommendation).** Keep ordekaart membership as the unit for identity, review and coverage, and for shared priors: wall family, detailing, seed. Within a unit, draw one elevation per segment, splitting at:

- a measured 3DBAG/AHN eaves step over 0.8 m;
- a corner;
- in the Centrum layer only, every plot unless something joins it: a face intent, a same-building read, or matching measured heights and BAG year.

Measured against the liked rows, this leaves 85 of 480 units (18%) disagreeing, against 188 (39%) for one elevation per unit.

**B. Measure the Centrum layer before deciding.** Run T7 first: about 40 hand-labelled units, ten per era, Nassaukade 506 included, plus 20 of the 46 disputed Centrum runs. That gives the false-merge rate of Centrum objects. It is about 60 small photo reads by two passes, with no batch reader.

**C. Ring layer only.** Phase 1 on the 19th-century Ring layer (13,881 pands, De Pijp and Oud-West). There the two De Pijp regression rows pass and no liked look contradicts it. Gordel and Centrum wait for A or B.

T7 (the answer key) was not done in phase 0. It is photo labelling that phase 2's scorecard needs, and given the token care asked on 2026-11-16 I did not start it before the premise question was answered.
