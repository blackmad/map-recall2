# Register facts to recipe reads (2026-11-10, lane register-recipes, follow-up to #316)

Measured on the 5,421 ride-priority pands (Centrum, Oud-West, Westerpark, Oud-Zuid, De Pijp, Oud-Oost) that have register facts;
paths: 5,135 generic chain, 140 model-covered, 129 landmark, 7 kit, 10 no facade. Raw data: `match-before.json`, `match-after.json`
(`scripts/register-facts/measure-recipe-match.ts`, `--registerFacts=1` for the after).

## Match rates, before and after the reads

| field | n | before | after | note |
|---|---|---|---|---|
| era (register facade/core date vs drawn facadeStyle) | 5,039 | 64.4 % | 98.0 % | 1,465 canal-dated pands were drawn c19/school/modern from a rebuild year in BAG |
| finish (plaster/paint vs brick wall colour) | 550 | 46.5 % | 98.2 % | 254 light fronts were drawn brick red |
| gable kind, all paths | 4,455 | 80.1 % | 86.4 % | before: monument-gables.json lacks ~250 pands the new parser names |
| gable kind, generic path, cornice read as flat | 4,290 | 87.0 % | 92.0 % | rest: irregular plans left flat (bell 37, neck 51, plain 26) and gables-extract vs facts disagreement on multi-monument pands (~200) |
| storeys (drawn eaves/3.2 m vs register count) | 269 | 24 % exact, 61 % within one | unchanged | no read: the storey count follows the 3DBAG height |
| stated extras present on the street wall (expected, dice vs forced) | | | | hoist beam 14 -> 74 %, stoop 27 -> 89 %, kroonlijst 17 -> 87 %, console cornice 18 -> 93 %, door surround 41 -> 94 %, gable stone 8 -> 93 %, corner pilasters 22 -> 92 %, wall anchors 13 -> 89 %, string courses (speklagen) 30 -> 79 %, shutters 6 -> 73 %, bay window 18 -> 67 %, iron balconies 33 -> 64 % |

"After" extras are the expected presence (forced = 1 where the style is canal/c19), limited by the per-wall triangle budget (35 of 40 test walls kept a forced hoist beam).
Not drawable at all by any extra: sculpture, festoons, oeil-de-boeuf, claws, pediment, attic, balustrade, twin gable, glazing-bar pattern (see hand-back).

Which reads matter most: era (1,465 pands) and finish (254) first, then the stated extras (749 pands name consoles, 412 stoeps, 355 door surrounds), then the 246 gables the stale gables extract missed.

## Golden (200 records, hand-checked against the Dutch text)

| field | n | before fixes | after fixes |
|---|---|---|---|
| facade date | 154 | P .92 R .90 | P .98 R .97 |
| core date | 57 | P 1.0 R .20 | P .98 R .93 |
| type | 191 | P .97 R .93 | P .98 R .98 |
| gable | 150 | P .98 R .86 | P 1.0 R 1.0 |
| finish | 20 | P .86 R .90 | P .95 R 1.0 |
| style | 51 | P .98 R .98 | P 1.0 R 1.0 |
| elements | 204 | P .98 R .88 | P 1.0 R 1.0 |
| stone bands | 8 | P .89 R 1.0 | P .89 R 1.0 |
| storeys | 3 | P .75 R 1.0 | P 1.0 R 1.0 |

Caveat: the parser fixes were made against this same golden (in-sample), and the truth was formed from the parser output corrected by hand, so the "after" is optimistic.
Known remaining errors: type of a dwarshuis against a church, hoekpand with bedrijfspand, facade date typos ("achttiendee"), a date after a roof clause, villa built "gebouwd 1925" late in the text, "17e en 18e eeuw", fence records (stone bands), mixed finishes (kept unstated).
Records changed in the older 36 after re-reading: inline-3155 punttop is a plain gable; 2656 triglyfenlijst is a cornice front; 5904/6330 pilasters and 847 anchors are stated; 2023 "2e helft 19e eeuw" is 1850-1899; 6166 "Panden" is a house.
Parser changes: type read only in the first 90 characters, houses (huisje, panden, achterhuis), early building date as core date, "uiterlijk/huidige gedaante" facade dates, helft/laatste kwart/"derde of vierde kwart"/"X of Y" periods, mixed finishes unstated, replaced gables dropped, staafankers, oeils-de-boeuf, balcons, stoepje/stoeppalen, Art-Nouveau, "na-empire" is not empire, new gable words (punttop, klokvormige geveltop, tuitvormige voorgevel, halstop, ingezwenkte hals, triglyfenlijst, onder verhoogde/gesneden/rechte ... lijst).

## Reads (flag `?registerFacts=0`, default on in the lane only: `REGISTER_FACTS_DEFAULT` in `facade/registerRecipe.ts`)

Decorator `withRegisterFacts` runs before `decorateFacade`: gable -> `monumentGable` when unset; date -> `constructionYear` when the register era differs from the BAG era (BAG year kept as `bagConstructionYear`); finish -> `registerFinish` (wall colour family in `decorateFacade`); stated elements -> `registerForce` (dice of those wall extras set to 1, also on a canal/c19 house whose period the table does not list); dakkapel -> `roofDormer`. Measured appearances, kit walls and landmarks are untouched; a pand without facts comes back as the same object.

## Strips

`strip-a.jpg`, `strip-b.jpg` (panorama | before | after, 10 houses plus the Nieuwmarkt row; Felix Meritis 4, Vijzelstraat 4, Langestraat 2, Nieuwmarkt). Honest verdict: the camera framing is poor (the picker faces the nearest free space, several shots look into courtyards or alleys, the Nieuwmarkt panorama is a side street), so the sheets show the era/finish effect (e.g. Vijzelstraat 176080 buff to plaster white, 175292 recoloured, Nieuwmarkt row gets canal-era brick) but are not a likeness verdict. Gallery-size review of the extras (stoeps, hoist beams) was not possible at this framing; a second strip pass with frontal cameras is advised before un-holding.
