# Canal-belt addendum (2026-11-10)

The user: "we need to focus on buurts in the canal belt and just outside". Across Grachtengordel-West, Grachtengordel-Zuid, the Burgwallen and Nieuwmarkt/Lastage, 0 buurten have their own look today. These pands are drawn by the generic canal-house chain plus register facts (era, finish and gable from `monument-facts.json`). That is not kit made for the buurt, and coverage rightly does not count it.

This is the most-ridden, most-photographed part of the city. The bar is likeness, not count.

## What is different from the Landlust, Vogelbuurt and Indische lanes
- **Mostly 17th–18th-century canal houses.** Few repeated rows; many one-off fronts with shared grammar. Draft types per gable family rather than per row:
  - step, neck, bell, spout, cornice (lijstgevel) and later 19th-century fronts;
  - storey count and bay count;
  - window kind, head and pane layout per storey (the user's priority);
  - white frames, speklagen, sills, keystones, arch rings, quoins;
  - hoist beams and hijsbalk hooks;
  - stoeps and basement doors;
  - shop ground floors where present.
- **Gables are symmetric.** Crown and roof come from the front photo, not 3DBAG. A lopsided gable means a 3DBAG plane above the crown, or an occluded flank's step count was used.
- **Use the register.**
  - `public/data/extracts/amsterdam/monument-facts.json` and `src/canalRecall/buildingRecipe/historicPasses.ts` give era, finish and gable per monument.
  - Cross-check every type against them, and cite the register when the photo is ambiguous.
  - Rijksmonument text is evidence, but the photo wins on what is visible.
- **Benchmark:** Nassaukade 506 (see `docs/` and the block-face faces for it). White bands, eared surrounds, painted-black brick, timber balconies, bay windows and pediment dormers must all be expressible.
- **Read the existing canal-house kit before adding parts.** It lives in the `src/canalRecall/canalhouse*.ts` modules and in the block-face kit. Prior Jordaan and Bilderdijk block faces already live in `scripts/block-face/faces/`. Extend these, typed and tested, and byte-identical when absent.
- **Panoramas along canals:** the water side gives a clean head-on view. Prefer quay-side panoramas, and check for trees and boats occluding the front.
- **Landmarks:** skip pands already drawn by bespoke or landmark GLBs. The tier precedence handles them, but do not spend strips on them.

## Order of work
Take the ridden canal and street fronts first (the `route m` column in `docs/reports/ride-ring-buurten-20261110.md`), then fill in the buurt. Install in coherent runs of a quay or street side, so the ride shows a whole stretch with its own look.
