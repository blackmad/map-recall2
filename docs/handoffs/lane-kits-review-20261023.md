# Lane: kit buildings earn their review (K)

Plan §3. Rules: `LANE-RULES.md`. The 546 parametric kit buildings
(`src/canalRecall/landmarkKits.ts`: `HAND_KITS` plus the generic worship and
public kits from `worshipBuildings.ts` and `publicBuildings.ts`) are drawn in
the game and count toward nothing until a review turn has looked at each one
beside a photo. Census row key: `kit:<name>`.

## Role A — sheets (haiku)

1. Write `scripts/landmarks/kit-sheets.ts`: for every kit in `KITS` (skip the
   names the census marks as carried by a bespoke model: `npm run census -- --write`,
   then rows with `tier: "landmarkKit"`), render the kit at gallery-card size
   from the sun side and the shade side the way
   `scripts/landmarks/citylook-gallery-review.mjs` renders landmarks, and put
   beside it the nearest municipal panorama crop of its main front
   (`scripts/pand-reference/all-walls.ts --pand=<pand> --max=2`, pand resolved
   the way `scripts/coverage/build-coverage.ts` resolves kit part ids through
   the BAG index). Pages of four, 1600 px wide, a header with the kit name,
   its parts and the pand; `artifacts/strips/kits-<n>.png` + `kits-<n>.json`.
2. Run it over all kits in order of the coverage extract's `priority` for the
   kit's buurt (`public/data/extracts/amsterdam/coverage-v1/buurten.json`).
   No kit is skipped for lacking a photo; the page says "no photo".
3. Report: pages, kits without a photo, kits whose pand could not be resolved.

## Role B — review turns (opus, ~20 kits per turn)

Judge each kit against its photo: massing and tower stages right, roof
material right, window rows roughly where the photo has them, no blank wall
facing a street. Write `public/canal-drive/landmark-reviews.json`
(`{"reviews": [{"key": "kit:<name>", "verdict": "pass|hold", "note": "...",
"sheet": "...", "date": "YYYY-MM-DD", "model": "opus"}]}`; append, never
rewrite others' rows). A `hold` names what is wrong in one line.

Kit-level defects that repeat (a tower stage too short, a rose window missing,
a nave roof too dark) go to `docs/handoffs/kit-gaps.md` under a "landmark kits"
heading with the count of kits affected. One Opus kit session a week fixes the
top two in `landmarkKits.ts` / `worshipBuildings.ts` with a test, then the
affected kits are re-sheeted and re-reviewed.

## Acceptance

Every kit has a row in `landmark-reviews.json`; `npm run census` counts the
passes; the held list and the kit gaps are in the report. Expect roughly 60 %
to pass on the first turn.
