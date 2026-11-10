# Grachtengordel-Zuid buurten: Vijzelstraatbuurt (AG05) and Rembrandtplein e.o. (AG03), 2026-11-10

Lane `lane/belt-gg-zuid-20261110`. District type folder: `scripts/block-face/types/grachtengordel-zuid/`.

**Result: 4 pands installed, all in Vijzelstraatbuurt**, as two runs on the Keizersgracht even side:
- `keizersgracht-596-648-r1`: 616A and 614.
- `keizersgracht-596-648-r2`: 610 and 608.

Rembrandtplein e.o. has none installed. This is a low yield. The southern belt's canal fronts that I looked at are mostly:
- wide 19th- and 20th-century office and bank fronts, which the 1600–1900 types veto;
- painted or dark fronts that fail likeness;
- faces with no usable photo (scaffolding, trees, sky gaps).

## Census

| buurt | pands | proposed faces | intaked faces (strip) |
|---|---|---|---|
| Vijzelstraatbuurt (AG05) | 379 | 31 | 7: herengracht-468-480, herengracht-518-532, keizersgracht-557-585, keizersgracht-596-648, keizersgracht-615-661, keizersgracht-660-710, prinsengracht-809-815 |
| Rembrandtplein e.o. (AG03) | 257 | 74 | 8: amstel-8-22, amstel-16-34, amstel-28-36, amstel-102-110, amstel-116-132, amstel-180-192, herengracht-519-561, herengracht-563-587 |

Notes on intake:
- Intake spends about 400 s per face in the BAG uses step.
- I stopped the intake of the Reguliersgracht, Prinsengracht (819-927, 955-1047), Vijzelstraat, Thorbeckeplein and Rembrandtplein faces before they finished.
- prinsengracht-819-927 failed its seed check: its seed pand has no frontage on Prinsengracht.
- herengracht-468-480 first came out grey from a 404 panorama day (2023-04-17). After cherry-picking 9c09e2883 I re-intaked it on 2023-02-27.

## Types (one per gable family, drafted from Keizersgracht 596-648 and Herengracht 518-520)

**`belt-1700-canal-house`.** Measured on Keizersgracht 596-648 (strip 2023-03-27).
- Frontage 3.8–10.6 m; 3–5 storeys.
- Ground: a souterrain plus a raised bel-etage on a stoop.
- Storey weights: [2.8 souterrain, 4.2, 3.7, 3.35, 2.85].
- Windows: `sash-4-over-4` with sills.
- A frieze cornice with an entablature at most 2.4 m tall.
- Crowns:
  - cornice;
  - cornice with a pediment dormer;
  - neck (wing scrolls and a cartouche);
  - bell.
- Dark brick, white frames.

**`belt-1700-double-house`.** The five-axis double front, 10–16.5 m, door in the centre bay.
- Crowns: cornice, cornice-dormer, and cornice-crest (a crest gablet over the cornice).
- Measured on Herengracht 518, 520 and 472.

## Counts (49 pands compared on 6 faces)

- **Vetoed before comparison: 29.**
  - 26 at the match stage: built after 1900 (1905 office fronts, 1919, 1989, 2000), frontages of 15–37 m, or a skyline crown no type draws.
  - 3 at evidence: under 75 % sky, or 36 % of the strip without panorama data.
- **Compared and held: 16.**
  - 7 on likeness: edge NCC below 0.15. These are:
    - Keizersgracht 604, 602, 600 and 596;
    - Herengracht 522, 520 and 518.
  - 3 on review:
    - Keizersgracht 612: its storey grid differs from the type's.
    - Keizersgracht 618: it would be a run end with a 707 m² blank party wall next to the held 620.
    - Herengracht 526-528: one pand holds two fronts.
  - 6 as a run of one.
- **Placed and installed: 4.** Keizersgracht 616A, 614, 610 and 608.

Of the four faces that were not intaked by hand, I looked at the sheets of three and held them all:
- keizersgracht-615-661: scaffolding and a grey gap;
- keizersgracht-660-710: trees, the synagogue, Museum Van Loon;
- the Amstel faces: one-offs between larger buildings.

## Kit additions (typed, tested, byte-identical when absent)

- **`sash-4-over-4` window kind** (in `intent.ts`, `fit.ts` and the de Baarsjes list): the 19th-century reglazed sliding sash.
- **Souterrain-first `storeyHeights`** (in `houseType.ts`).
  - A list with one more entry than the storeys keeps the souterrain weight first when the storey count is resized.
  - A shop ground drops the souterrain weight.
  - A neck or bell crown with `cornice: "none"` drops the body's entablature.
- **`countStoreys` eaves pins** (`reviewEaves.ts`, `auto-place.ts`). The reviewer-measured cornice top sets the line that storeys are counted from, because 3DBAG reads the belt eaves 2–4 m low.
- **`match.typeGround`** (`autoPlace.ts`).
  - The type draws its own stoop ground even when BAG says the use is trading.
  - The ground use is then recorded as `residential`, with agreement `conflict`, and the register use is kept in the note.
- **Tests:** `src/canalRecall/blockFace/grachtengordelZuid.test.ts` (6 tests).

## What the kit cannot say yet

- Thick white window frames and eared stone window surrounds.
- Door surrounds with pilasters and a fanlight.
- Stoop iron railings.
- Balustrades.
- Frieze lettering, consoles and dentils.
- Frieze cornices taller than 2.4 m.
- The recipe roof shows as red tile above a frieze cornice where the photo shows sky. This is the 610 and 616A look.
- A double neck gable over one 11 m front (Keizersgracht 620).
- Two fronts with different crowns in one BAG pand (Herengracht 526-528).
- A painted-black or dark-neutral front that likeness can resolve (Keizersgracht 600 and 602).
- The tall narrow-window glazing band of the Herengracht double houses. The model's glazing share is 0.41 against 0.26 on the photo.
- The double-house exceeds the 3,000-triangle budget at 5 bays with the crest crown (520: 3,430 triangles).

## Sheets

- `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/vijzelstraatbuurt-20261110/`
- `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/rembrandtplein-eo-20261110/`

## Not done

- AG04 Spiegelbuurt and AG02 Geelvinckbuurt.
- The Prinsengracht, Reguliersgracht and Vijzelstraat faces. Prinsengracht eaves are 10–11.6 m, so those faces need a lower type.

## Kit round 2 (after the Opus strip review, docs/reports/gg-zuid-strip-verdict-20261110.md)

I re-installed Keizersgracht 616A, 614, 610 and 608 (runs r1 and r2) with the fixes below. Every gate passes and the GLB audit is clean.

Edge NCC before → after:

| Pand | Before | After |
|---|---|---|
| 616A | 0.367 | 0.415 |
| 610 | 0.180 | 0.206 |
| 608 | 0.164 | 0.193 |
| 614 | 0.215 | 0.168 |

614 dropped: the grey base and the one-over-one sashes are what the reviewer asked for, but they remove edges.

### New kit

Each part is typed, tested in `buildingRecipe/beltFront.test.ts` and `blockFace/grachtengordelZuid.test.ts`, and byte-identical when absent.

- **`windowFrames`** (`beltFront.ts`):
  - `{frame}` draws the thick white window frames, 0.12 m on the belt, in place of the 0.07 m default.
  - `eared: {upper, band?, ear?, drop?}` draws painted eared surrounds on the top storeys: jamb bands, a head running past them, and ears dropping down the jambs. 616A has them on the top 2 storeys, 614 on the top 3.
- **`basementDoor`:** a street-level door in the stone base, under an all-window bel-etage. The type's `base-door-left` ground selects it, and mirroring moves it to the right (614). Its cream surround is the door frame drawn 0.14 m wide.
- **`doorSurround {pilaster, cap}`:** painted pilasters and a cap round the stoop door and its fanlight, set 0.03 m clear of the door frame so the faces are not coplanar.
- **`stoopRails {rail}`:** rails on both sides of the stoop, using the library's existing `entrance.rails`.
- **`atticWindowWidth`:** a crown field; 608's neck light is 1.4 m wide.
- **`gableOrnament.wingDepth`:** 608's claw pieces at 1.8 m. The scroll grows in proportion.
- **`sash-1-over-1`:** a new window kind (614's bel-etage).
- **`entablature.dentils {pitch, block, rise}`:** a modillion row under the cap. It is in the kit but **not used by the types**: on the first house of each run, the two end blocks fail the GLB audit's opening-outside check. Each failing block is 0.03–0.05 m² at 18.4–18.8 m. Moving the row 0.7 m in from the party walls did not help, and I did not weaken the audit.
- **Review pins:**
  - **`<buurt>-review-overrides.json`** (`blockFace/reviewOverrides.ts`) sets per pand:
    - body fields: windows, storeyWindows, headLines, windowHeights, windowFrames;
    - a named ground variant;
    - the placement roof.
  - **`reviewRoofs.ts`** is ported from lane/buurt-dentex-frederiksplein-20261110 (639978c1f), byte-for-byte, and hooked into auto-place. It is not used here: 3DBAG stands under the cornice at the facade, so a roof pin cannot re-pitch the roof. The flat roof comes from an override pin with `roof: {form: "flat"}` (616A, 614, 610), and the red tile behind the cornice is gone.

### Per-pand fixes (override and palette pins)

- **616A:**
  - base-door ground, door on the left;
  - six-over-six sashes;
  - eared surrounds on the top 2 storeys;
  - stone `#878279`, frieze `#c7bda6`.
- **614:**
  - base-door ground, mirrored to the right;
  - one-over-one sashes on the bel-etage;
  - eared surrounds on the top 3 storeys;
  - stone `#a5a69e`.
- **610:**
  - `cross` windows, with a `casement-transom` light on the top storey;
  - heads raised (headLines 0.95/0.92, taller windowHeights);
  - stone `#999588`.
- **608:**
  - six-over-six sashes;
  - heads raised as on 610;
  - a 1.4 m gable light;
  - 1.8 m wing pieces;
  - stone `#999588`.

### Findings

- **Frieze cornices taller than 2.4 m are not needed.** The 3–4.5 m band on the strip is the modillion soffit, seen from below and stretched by rectification. 3DBAG and the frieze foot put the entablature on the facade plane at about 2.4 m (616A: frieze foot 17.0 m, cornice 19.3 m). The 2.4 m limit stays; `helmersKit.test.ts` pins it.
- **The kit has one stone colour per house.** Pinning 608's base grey also greys its sandstone wing pieces and cartouche. A separate ornament or plinth colour slot would fix this.
- **Double-house triangle budget.** It is not addressed. No double-house is installed, and Herengracht 520 is held on likeness at 3,430 triangles.
