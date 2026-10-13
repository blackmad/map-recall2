# Lane: signature-ornament inventory of the bespoke landmarks (2026-10-13)

User feedback 2026-10-13: the Hoofdbureau van Politie shipped without its
sculpted Amsterdam-arms relief (lion, banner, three figures) on the
Marnixstraat end wall; the lane had seen it and listed it under "what the
large systems could not express". For hand-modelled buildings the lane must
infer which ornaments, reliefs, sculpture groups, lettering and signs are the
building's signature, and model them. This lane makes that systematic.

Inputs: `src/canalRecall/landmarks/manualCatalogue.json` (302 landmarks),
builders `scripts/landmarks/*-builder.ts` and specs `*-spec.json`,
`npm run pand-reference -- <pand>` (Amsterdam panoramas CC BY 4.0; rectified
crops), `scripts/pand-reference/all-walls.ts` (one crop per exposed wall),
`scripts/landmarks/*-research.json`, Wikipedia / Rijksmonumenten register
text for named reliefs and sculptors (CC0 / CC BY-SA, cite). Lane owns
`scripts/landmarks/ornament-inventory.json`, `scripts/landmarks/ornament-inventory.ts`,
and builder edits for the models it fixes (+ rebuilt GLB and lod1). Do not
edit `game.js`, `index.html`, `package.json`, bundles, catalogues, generated
manifests, `TODO.md`, `HISTORY.md`. Avoid `hoofdbureau-elandsgracht` and the
batch-3 list (haparandaweg-2-4, petrus-en-paulus-kerk, opstandingskerk,
rialto, valley, felix-meritis, jodenbreestraat-11, hotel-de-l-europe,
mountain-network, palace-on-the-dam): another lane owns them.

## Deliverables
1. **Inventory tool**: `ornament-inventory.ts` renders each landmark's
   exposed walls next to its rectified crops (reuse the review-sheet code)
   and writes `ornament-inventory.json`: per landmark, per wall, a list of
   `{kind: relief | sculpture | lettering | sign | clock | crest | gable-stone |
   balcony-ironwork | canopy | other, where, approxSizeM, modelled: yes | simplified |
   no, note, source}`. Judgement from the crops is the point; keep entries
   short and only for things a rider would notice at 1.7 m eye height or on a
   gallery card.
2. **Run it on the 60 most-visited landmarks** (destinations by
   `scripts/landmarks/landmark-backlog` priority or simply the manual
   catalogue entries with a Wikipedia POI card), then on everything built in
   October 2026 (`model-dates.json`). Report the table of misses ranked by
   visibility.
3. **Fix the cheap misses** in their builders (lettering via `signage.ts`
   stroke font, crests and gable stones as low-relief slabs, clocks, blue
   police lamps, canopies), ≤ 1.5k extra tris each, gates and `audit:glb`
   still PASS, a before/after strip per model under
   `artifacts/ornament-inventory/`. Leave sculpture groups needing a modeller
   as `modelled: no` with a note; they feed the splat/impostor track.
4. **Make the process enforce it** (the section "Bespoke landmark lane:
   photo first, inventory before geometry" in `docs/buildings-pipeline.md`
   is the spec; the user asked that the process be right the first time):
   - `scripts/landmarks/landmark-brief.ts --pand=<id> [--id=<slug>]`: fetches
     panoramas (`pand-reference`, `all-walls.ts`), BAG/3DBAG facts, monument
     register text (data.amsterdam.nl `monumenten`, CC0) and writes
     `scripts/landmarks/<id>-brief.md` with one rectified crop per exposed
     wall and an empty inventory skeleton, so no brief is written from
     memory. Run it for the Hoofdbureau as the worked example and compare
     with the wrong brief in `lane-hoofdbureau-elandsgracht-20261013.md`.
   - Per-landmark `scripts/landmarks/<id>-inventory.json` (schema in
     `src/canalRecall/landmarks/ornamentInventory.ts`, validated, tests).
   - `scripts/landmarks/check-landmark-inventory.ts`: every landmark whose
     first export date (`model-dates.json`) is after 2026-10-13 must have an
     inventory with every item resolved, and no `skipped` reason may be
     "no component" / "cannot express"; `build-manual-landmarks.ts` refuses
     to export such a landmark without it; `audit:glb` prints the inventory
     rows under the gates. Report the `package.json` line for `check:canal`
     (integrator adds it).
   - `review-sheet.ts`: an optional inventory column so each `modelled` item
     shows its photo crop and render side by side.

## Checks
`npm run lint`, `npm run test:geometry-audit`, `npm run audit:glb -- --id=<each fixed id>`,
`npm run check:osm-under-models`. Report: branch, SHA, the miss table, the
models fixed with strips, what is left.
