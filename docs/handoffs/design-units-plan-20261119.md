# Buildings as designed: week review, a new identification pipeline, and the route to a fully described ring

## Context

You asked three things: how the past week went, a serious rethink of how we identify buildings (the per-building kit rendering is bad on continuous blocks), and a realistic route to 100% of the ring.

Short answers:

- **The week:** a lot of motion, little net. One method worked (Rivierenbuurt and Apollo/Stadion, 4,177 fronts live, your "Looks good"). In the older city, three district looks sit staged after about 40 rounds, and none has your sign-off.
- **The cause:** we identify and draw by BAG pand, then guess which pands are one building. We also scored ourselves against "today", which is easy to beat.
- **The find:** the city publishes the grouping we have been guessing. Its *ordekaart* layers outline each building as designed, with year and architect. On the four rows I tested, two of them the ones you flagged, it is right four times out of four.
- **The route:** make that "design unit" the unit of everything. First draw every unit as one coherent building, with no photo reads. Then describe units from better photos in ride order, scored against the photo, not against today.

## 1. How the week went (2026-11-10 to 11-16)

**Ring today.** The ring as our docs define it is centre plus inner ring: 198 buurten, about 60,000 pands, about 50,000 once sheds are excluded. 44 of the 198 buurten count as having their own look; that count predates the Rivierenbuurt and Apollo publish.

| How a ring pand is drawn today | Pands |
|---|---|
| Bespoke, chunks, recipes, building types | about 2,200 |
| Published row records (Rivierenbuurt, Apollo/Stadion, 10 on Kinkerstraat) | 4,172 |
| Partial facts on the generic draw (HouseSpec) | about 5,500 |
| A staged record only, so per-pand dice (belt, Jordaan, Weteringschans, Nieuwmarkt) | about 3,000 |
| No description at all: per-pand dice | about 44,700 (75%) |

About 6,600 fronts are staged in all, counting De Pijp's branch and fronts that also have another route.

**Your verdicts against our scores.**

| Work | Our blind score vs today | You |
|---|---|---|
| D1 per-building reads (293 fronts live, 285 pulled) | none taken | "awful ... might as well be random" |
| Belt as rows, Herengracht | 28–0 | "Gables still look pretty bad" |
| Centrum looks, rounds 7–9 | 14/15, 13/15 | "why does our model still seem to misunderstand continuous rows" |
| De Pijp, round 16 | 13/13 | "no, bad, they lose so much" |
| Rivierenbuurt, Apollo/Stadion | 7/7 held out | "Looks good" |

**Four causes, each seen on the sheets and in the code.**

1. **Wrong unit.** Every record is keyed on a pand, and "one building" is inferred afterwards. It fails both ways:
   - split: Marnixplein is one 1891 building over three pands, drawn as three houses with 4, 3 and 3 storeys and three roofs;
   - merged: Rustenburgerstraat is three designs over six pands, drawn as one flat type.

   In code:
   - the generator starts a new series when BAG years differ by more than one (`buurtGenerator/rows.ts`, `SERIES_YEAR_STEP = 1`);
   - any pand that already has a spec breaks its row, so two drawing routes meet mid-building;
   - the mesher varies bay width, storey height, ground-floor height and tone per pand by design; its comment reads "No two neighbours share a rhythm" (`threeBuildingMesh.ts:776–781`);
   - four separate structures each say "these pands go together": face intents, house rows, generator series and belt segments.
2. **Wrong bar.** A blind A/B against today rewards anything calmer than a random drawing. On Herengracht 179345 a brick and stone building is drawn as a ribbon-window office in both versions, and it counted as a win. The score could not tell us we were wrong, so lanes kept iterating. `check:rows` also passes when its input folder is empty.
3. **Thin evidence.** Sheets use one panorama stretched along a whole row, smeared a few houses from the camera. The window-head reader saw one cut per row (339 of 1,593 houses). Uncertain reads fall back to defaults (26 of 47 white fronts in De Pijp).
4. **Stated facts that never draw.** Plaster was read, stored and dropped before the wall (`threeBuildingFeatures.ts:214`). Mansards were dropped at staging. French balconies exist nowhere. Each district lane found such gaps only after several rounds.

## 2. The find: the city already publishes "one building"

Open data from Monumenten en Archeologie (maps.amsterdam.nl open geodata). Each polygon is a building as designed:

| Layer | Objects | Median footprint | Also carries |
|---|---|---|---|
| `ORDE_CENTRUM_GEBOUWEN` | 7,539 | 99 m² | year on 1,690 |
| `ORDE_RING_GEBOUWEN` (19th-century ring) | 5,454 | 233 m² | year and architect where known |
| `ORDE_GORDEL_GEBOUWEN` (1920–40) | 3,012 | 534 m² | year, architect on 2,357 |
| `ORDE_AUP_GEBOUWEN` (post-war) | 1,360 | 807 m² | typology, storeys, dwellings |

I joined four rows' pands to these layers:

| Row | Ordekaart | We drew |
|---|---|---|
| Marnixplein, 3 pands | 1 object (1891) | 3 different houses |
| Goudsbloemstraat, 7 pands | 1 object | 3 treatments, mixed storeys |
| Rustenburgerstraat, 6 pands | 3 objects, 3 architects (3 + 2 + 1) | 1 type |
| Van Ostadestraat, 10 pands | 4 objects, 4 architects (2 + 2 + 2 + 4) | 1 type, grouped 2 + 3 + 1 + 4 by height |

Limits: four rows only. The share of ring pands inside an object is unmeasured; footprint totals suggest most. Nothing in the house pipeline uses these layers today.

## 3. The new pipeline

**Rules.**

- The **design unit** is the unit of identity, description, drawing, review and coverage: one building as designed, over one or many pands.
- A unit has one elevation, laid out once along its frontage. Each pand draws its slice. Bay rhythm, cornice and roof then continue across party walls by construction.
- No value is seeded by pand. A value is read, inherited (unit, then same architect and year, then block face, then district) or a prior chosen once per unit. Each records its source.
- One joint read per unit from good photos, replacing separate readers per attribute per pand.
- Acceptance is an absolute score against the photo. "Beats today" stays only as a no-regression check.
- One generator; districts are data, not code forks.

**Tools to build.**

| | Tool | What it does | Builds on | Tokens |
|---|---|---|---|---|
| T1 | Design-unit index | Joins ordekaart objects to pands; orders members along each face; infers units where the layers are silent and marks them inferred; adds a family key (architect, year, module width) for designs repeated across blocks. | generator row builder (`buurtGenerator/rows.ts`), face discovery (`scripts/block-face/`) | none |
| T2 | Unit drawing | Elevation-and-slices in the renderer; every per-pand seed re-keyed to the unit; one eaves line and one roof per unit. A conformance test: every spec field must change the rendered strip. | `houseLine/rowFront.ts` (`withRowFront`, `RowSeriesDraw`), `houseSpec/row/types.ts`, the buurt kit, `oneSeriesPerBuilding` from the Centrum lane | none |
| T3 | Front mosaic | One square-on image per unit: each panorama contributes only the slice it faces, winter captures first, a second capture kept. Readers, judges and sheets all use it. | `house:crops`, `scripts/buurt-generators/sheet.ts` | none |
| T4 | Roof from above | Eaves line, ridge line, roof section and roof colour per unit from AHN4 and the PDOK orthophoto. | `beltLook/ahnFront.ts`, `roofSignals.ts`, `blockLines` | none |
| T5 | Unit describer | One scripted read per unit: module, bays, storey stack, heads, ground floor, crown, wall, white accents, attachments, exceptions per member. Two independent reads; only fields that disagree get a third look. | row-series vocabulary; the finish, colour and gable readers | measured in phase 2 |
| T6 | Scorecard | Per unit against the mosaic: eaves error in metres, roofline overlap, storey match, window grid match, wall colour distance, share of white. Plus a judge that names wrong attributes instead of picking A or B. Fails on empty input. | Node strip renderer, `houseSpec/rowChecks.ts` | few |
| T7 | Answer key | About 40 units labelled by hand, ten per era, Nassaukade 506 included. Readers and scorecard are measured against it. | | none |
| T8 | Coverage ledger | Share of fronts per tier, per buurt and ride-weighted. Replaces the own-look count as the headline. | `coverage-v1` | none |

## 4. Route to 100% of the ring

**Definition I am assuming:** the 198-buurt centre and inner ring; 100% means no front left on per-pand dice.

| Tier | Meaning |
|---|---|
| A | Bespoke, landmark, large recipe (as now) |
| B | Unit described from photos and passing the scorecard |
| C | Unit drawn as one building: grouping and heights measured, roof and wall colour measured as T3 and T4 land, detail from the era prior chosen once per unit |
| D | Per-pand dice (today's 75%). Target: zero |

**Size.** About 50,000 pands is roughly 15,000 design units (T1 measures it). Reads scale with units, and with families where a design repeats.

**Phases, each with a gate.**

0. **Index (about a day).** T1 across the ring, staged, with each layer's coverage reported. T7 labelled.
   Gate: the share of ring pands inside an ordekaart unit; the four rows regrouped correctly.
1. **Coherent units everywhere, behind a flag (days, no reads).** T2 on the existing generators. Every multi-pand building in the ring draws as one building.
   Gate: you look at about 30 blocks in the game, the flagged rows among them. This is the first visible result and it does not depend on any reader.
2. **Prove the described route on five blocks (days).** Jordaan: the Marnixplein and Goudsbloemstraat blocks. De Pijp: the Rustenburgerstraat and Van Ostadestraat blocks. One Rivierenbuurt block as control. T3–T6 end to end.
   Gate: you judge the blocks on their own merits. The scorecard must rank them as you do. Tokens per unit read reported.
3. **Tier C published by district (about a week).** Measured roofs and colour added; a district publishes when the scorecard holds and nothing already live regresses.
   Gate: tier D at zero on the ledger.
4. **Tier B by ride share (weeks, paced by token budget and kit gaps).** Centrum, then the 19th-century ring, then 1920–40. You sign off the first block of each era family; after that units publish on the scorecard.
5. **Residue.** Post-1965 infill, corners, large non-residential buildings routed to recipes or bespoke, and fronts with no usable photo, which stay at tier C.

**What sets the pace.** Kit vocabulary (French balconies, wall dormers, arched heads, tile ornament) more than reading; your review time; the share of fronts with a clear leaf-off photo. That share was measured in one pilot only: 64% of crops passed the automatic flags and 43% were good by hand label.

**Cost.** Unknown per unit until phase 2, and no batch read runs before you have seen that number. For scale: hand-modelling ran at about 3 M tokens a house, and this week's district lanes left no token record.

**How it runs.** Three lanes at most, each in its own worktree: units and ledger (T1, T8); renderer (T2); evidence and scoring (T3–T7). The integrator owns the shared files, merges and pushes.

## 5. What stops, what is kept

- **Stops:** blind-versus-today rounds on belt, Centrum and De Pijp; publishing those staged records as they are; new per-district generator forks.
- **Kept, re-keyed onto units:** the wall-colour, finish and gable reads (over 3,000 fronts), AHN heights, monument-register facts, the 310 face intents, the kit pieces those lanes built, and the live Rivierenbuurt and Apollo/Stadion records.
- **Untouched:** bespoke and landmark work, the lanes resumed today, Hoofddorpplein and Narva (their libraries are re-keyed in phase 3).

## 6. Decisions I have assumed

1. "The ring" is the 198-buurt centre and inner ring, and 100% means tier D at zero, with tier B following ride share.
2. The staged belt, Centrum and De Pijp looks are **held**, not published as an interim lift.
3. Phase 2 uses the Jordaan and De Pijp blocks named above, which hold the rows you flagged on #392 and the De Pijp sheets you rejected on #393.

## Critical files

- **New:** `src/canalRecall/designUnits/` (index types, family key, elevation slices); `scripts/design-units/` (ordekaart fetch into the source-data archive with licence and date, join, coverage report, staged output before `public/data/extracts/amsterdam/design-units-v1/`); `scripts/front-mosaic/`; `scripts/unit-scorecard/`.
- **Changed:** `src/canalRecall/houseLine/rowFront.ts`, `threeBuildingFeatures.ts`, `threeBuildingMesh.ts` (slices, finish passed through, no per-pand jitter inside a unit); `roofMesh.ts`, `bayLook.ts`, `genericFacades.ts`, `facadeExtras.ts` (seeds re-keyed to the unit); `buurtGenerator/` and `beltLook/` (series from units; merged into one generator in phase 3); `scripts/coverage/` (ledger).
- **Board:** `public/canal-drive/TODO.md` and `HISTORY.md` in the same change; this plan committed as `docs/handoffs/design-units-plan-20261119.md`.

## Verification

- **T1:** the four rows as named regression locations in unit tests; a coverage report per buurt and per layer.
- **T2:** the conformance test (each spec field changes pixels); byte-identical output with the flag off; `check:rows`, `test:canal-game-structure`, `npm run lint`.
- **T6:** agreement with the answer key and with your phase 2 verdicts before it gates anything.
- **In the game:** pinned-pose frames for the phase 1 and phase 2 blocks, desktop and phone, before any publish; `npm run check:canal` before each push to main.
