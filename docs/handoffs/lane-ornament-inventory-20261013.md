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
4. Add the inventory to the lane process: a short section in
   `docs/buildings-pipeline.md` ("Signature inventory") and a check
   `scripts/landmarks/check-ornament-inventory.ts` that fails when a landmark
   newer than the inventory has no entry.

## Checks
`npm run lint`, `npm run test:geometry-audit`, `npm run audit:glb -- --id=<each fixed id>`,
`npm run check:osm-under-models`. Report: branch, SHA, the miss table, the
models fixed with strips, what is left.
