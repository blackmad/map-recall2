# Register facts → recipes: review verdict (2026-11-10)

Review of lane register-recipes (HEAD ba9c324e9). The question: should `REGISTER_FACTS_DEFAULT` ship true, and which reads should be held?

**Verdict: ship `true`, with only the era, finish and gable reads on.** Every forced wall extra and the dakkapel read are held in `REGISTER_READS_HELD` (`src/canalRecall/facade/registerRecipe.ts`, tested in `registerRecipe.test.ts`). The finish read also needed a parser fix before it could ship (see below).

Sheet: `register-recipes-verdict-20261110/sheet.jpg`. Each row shows the panorama (Gemeente Amsterdam, CC BY 4.0), then before (`registerFacts=0`), then after (`registerFacts=1` with the shipping holds). Full-size frames, including the lane's no-hold after pass, are in `map-recall2-screenshots-a1/buildings/2026-11-10-register/ride3/` (`final/*-full.jpg` = photo | before | lane after | held after). They are not committed.

## How the frames were made

- **Pand choice.** `scripts/register-facts/frontal-spots.ts` picks register pands in Felix Meritisbuurt, Vijzelstraatbuurt and Langestraat e.o., plus the Nieuwmarkt 6–22 row. It prefers pands that state several elements. For each one it finds the street wall and the straightest panorama of it, using `scripts/pand-reference/select.ts`. I re-picked the panoramas from land only, because the boat panoramas sit at water level. I added two pands for the rare reads: 168578 (shutters) and 175318 (balconies).
- **Photo crops.** `scripts/register-facts/frontal-photos.ts` cuts each panorama thumbnail at the render's heading and field of view.
- **Renders.** `tests/e2e/register-frontal-strip.spec.ts` parks the rider at the panorama spot, using `#race=` with Dam as the finish. That way the detail tier draws the wall. The camera stands at that spot, 6 m up, level, with a 70° vertical field of view. The page runs `world=live`, because compiled world-v1 cells bake the decoration in and ignore the browser flag. A probe confirms that the review pand is at the screen centre in 11 of 12 frames; in 168578 it is at the left quarter.
- **Why not the gallery or playground renderer.** The house playground's real-building view (`galleryGl`) drew no building meshes in headless Chromium, with either SwiftShader or Metal; only the outline showed. So the frames come from the ride engine instead.
- **The lane's own strips were mis-framed for a second reason.** Their rider was elsewhere, so the frames showed coarse and baked tiers, not the detail tier.

## Per pand (likeness against the photo)

| pand | before | after | what changed | reads judged |
|---|---|---|---|---|
| Felix 176312 (1896 corner, bay + gable) | FAIL | FAIL | nothing visible (one band 1 px) | forced bay window, hoist beam, gable stone, anchors: not drawn in view |
| Felix 176346 (Utrecht gallery block) | FAIL | FAIL | none | balcony, bay, kroonlijst, stoep, speklagen: none drawn; generic row stays |
| Felix 169116 (Keizersgracht 1617) | FAIL | FAIL | none | drawn pale; photo is dark brick. Lane parser said *plaster* (a plastered detail in a long text), which would push it further wrong; fixed |
| Felix 168578 (1935 Delft School office) | FAIL | FAIL | none | lane parser read *stone* from "hardstenen gevelsteen"; fixed. Shutters on a 1935 office not drawn |
| Vijzelstraat 180181 | WARN | WARN | none | stoep, console cornice, door surround: not drawn |
| Vijzelstraat 167483 | WARN | WARN | slight | photo is painted black brick; drawn brown either way |
| Vijzelstraat 171023 | WARN | WARN | slight | speklagen (string courses) not drawn |
| Langestraat 175320 (rich door surround, stoep) | FAIL | FAIL | none on the pand | stated stoep, door surround and basement well, ground floor in view: **not drawn** |
| Langestraat 168136 (plastered, fantasy top) | FAIL | FAIL | era c19→canal sash style | finish *light* is right, but the mapped wall colour wins, so it stays red brick |
| Langestraat 175318 (Singel 54, XIXc) | WARN | WARN+ | era canal→c19: large-pane c19 windows like the photo | **era helps the windows**; the wall turns orange where the photo is dark brown (slightly worse); balconies not drawn |
| Nieuwmarkt 20–22 (182857, 1605 twin step) | FAIL | FAIL | none | speklagen force not drawn; the photo's white bands are not expressed |
| Nieuwmarkt 6–22 row | WARN | WARN+ | 182849 (XVIII) c19 arched windows → canal sashes | era helps; colour (painted black front) is missed either way |

There is no regression caused by a read in any of the 12 frames. The held run and the lane's no-hold run are pixel-identical in 11 of 12 frames; 176312 differs by one thin band. So in the live ride, the forced extras and the dakkapel make no visible difference in these frames.

## Per read

| read | ship / hold | evidence |
|---|---|---|
| era → constructionYear | **ship** | Visible gains on Singel 54 (c19 windows) and Nieuwmarkt 10–12 (canal sashes); neutral elsewhere; no regression. Watch: "vernieuwd" fronts such as Nieuwmarkt 6 (XIXd renewed step gable) now draw c19; that frame is neutral. |
| finish → wall family | **ship, with the parser fix** | A long description names plastered lintels, pilasters and interiors on brick fronts. Before the fix, 9 of 10 sampled long-text *plaster* reads were wrong. Fix in `registerFacts.ts` (`LONG_DESCRIPTION = 800`): a long text needs a plastered *front*; and *stone* needs `gevel\b`, so a gevelsteen no longer counts. Rebuilt staging: 61 plaster→brick, 37 plaster→unstated, 8 stone→unstated. Golden unchanged (finish P .95 R 1.0). The finish rarely shows anyway, because a mapped colour wins. |
| gable → monumentGable | **ship** | Golden P/R 1.0; already in world-v1 through monument-gables.json; nothing contrary in the frames. |
| dakkapel → roofDormer | **hold** | The roof is not in frame from the street, so the roof plane is unverified. |
| hoist beam, stoep, kroonlijst, console cornice, door surround, gable stone, pilasters, anchors, cellar entrance | **hold** | Not drawn where stated and in view (175320 stoep and door surround). Shipping would claim fact-match rates with no likeness shown. |
| balcony, bay window, shutters | **hold** | Same as above. In addition, 263/297 balcony, 254/282 bay-window and 36/44 shutter statements come from long descriptions covering side or rear walls and whole complexes, and these are the kit forms most likely to look wrong. |
| speklagen → string courses | **hold** | Not drawn on Nieuwmarkt 20–22, where the photo's bands are the defining feature. |

## Integrator TODO

- Commit the three bundles together with this change: `npm run build:canal-three-buildings && npm run build:canal-buildings && npm run build:canal-engine`. The lane checkout keeps the committed bundles.
- Rebuild staging with the fixed parser, then publish: `nice -n 19 npx tsx scripts/register-facts/build-monument-facts.ts` and then `--publish`. Staging is gitignored, so this lane's rebuild does not travel with the branch.
- A world:compile then bakes era, finish and gable into world-v1. Without it, only `world=live` shows the reads.
- Before releasing any element hold, find out why `registerForce` draws nothing in the ride. The unit test forces them in `wallExtras`, but stoep and door surround were absent on 175320 in the live detail tier. Then shoot this strip again with `REGISTER_READS_NONE_HELD`.
- The match rates in `register-recipes-20261110.md` for the stated extras describe the lane's no-hold set. With the holds, those extras are back to the dice.

## Kit cannot yet express (from these photos)

- Painted-black brick fronts (Vijzelstraat 167483, Nieuwmarkt 10–12).
- White-banded speklagen with block quoins (Nieuwmarkt 20–22).
- Rich door surrounds with fanlight tracery (175320).
- 1890s corner bay with a half-timbered gable (176312).
- The Utrecht gallery block (176346; a landmark candidate).
- Dark brick read as pale on 169116 (the appearance prior is wrong before any register read).
