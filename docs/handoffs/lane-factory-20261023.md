# Lane: landmark factory (F) — batches on Haiku, review turns on Opus

Plan: `docs/plans/thousand-buildings-20261023.md` §3. Rules: `LANE-RULES.md`.
Two roles share this brief. Neither reads anything beyond it and the files it names.

## Role A — batch runner (haiku, continuous)

Inputs: `public/canal-drive/landmark-factory-queue.json`, the factory scripts
(`scripts/landmarks/factory.ts`, `factory-queue.ts`, `scripts/building-recipes/strip.ts`),
the source-data archive at `MAP_RECALL_SOURCE_DATA` (defaults to
`/Users/blackmad/Code/map-recall2-source-data`).

Per batch (in your lane worktree, branch `lane/factory-<batch>-<date>`):

```sh
npm run factory:queue -- --write                                   # refresh rows; never drops status/verdicts
npm run factory -- --ids=20 --owner=factory-<batch>                # crops → facts → draft → measure → compile (+ sheets)
npm run factory:strip -- --queue=public/canal-drive/landmark-factory-queue.json --status=compiled --limit=20 --out=artifacts/strips/<batch>
/usr/bin/git add scripts/building-recipes/houses public/canal-drive/landmark-factory-queue.json && /usr/bin/git commit -m "Factory <batch>: n compiled, m no-evidence"
```

Then report (the LANE-RULES block) with: compiled / no-evidence / error counts,
the strip pages (`artifacts/strips/<batch>-<n>.png`) and `<batch>.json`, and
the error notes verbatim from the queue. Do **not** judge the sheets, do not
edit intents by hand, do not install. An `error` row you can explain in one
line (network, missing tile) stays as is; anything else goes in the report.

Do not run two batches at once on one machine: each compile opens its own
headless renderer.

## Role B — review turn (opus, one strip per turn)

Open every page of the strip (`<batch>-1.png` … `-5.png`) and `<batch>.json`.
For each house, judge the three panels (photo | front | 3/4) and the header
line (gates, likeness per group; `g1*` = a group on a named street) by
`docs/START-HERE-buildings.md` §3: wall colour family and lightness, glazing
share per storey, window shape class, bay rhythm. Write one row per house into
the queue (`verdict`) and set the status:

| outcome | status | what you write |
|---|---|---|
| `pass` | `reviewed-pass` | `note` one line |
| `fix` | `reviewed-fix` | `fix`: intent field → value, e.g. `{"walls[1].system": "ribbon-windows", "palette.brick": "#6c5440"}`; at most three edits |
| `hold` | `held` | the reason (a kit gap, a wrong shell, a group with no photo on the street side) |
| `no-evidence` | `no-evidence` | which walls lack a usable crop |

Kit gaps go, one line each, into `docs/handoffs/kit-gaps.md` with the house
id and the count of houses that hit the same gap. Finish with
`npm run census` and put its headline in the report. A review turn is ~40k
tokens in; keep the output to the verdict rows and the gap lines.

## Role A again — after the verdicts (haiku)

- `reviewed-fix`: apply exactly the listed edits to `houses/<house>/intent.json`,
  then `npm run factory -- --pands=<pand> --stage=compile --owner=factory-<batch>`
  and re-strip those houses only; status goes back to `compiled` for a second turn.
- `reviewed-pass`: `node --import tsx scripts/building-recipes/install-large.ts --house=<house> --install`,
  `npm run check:stale-installs`, set status `installed`, commit. If the
  install refuses (likeness gate on a street group), write the refusal into
  the row's notes and set `held`; never `--allow-inferred` without a verdict
  that names the group and the reason.

## Integrator (opus, daily)

Merge lane branches; `npx tsx scripts/build-covers.ts` → copy
`artifacts/bag-tiles/covers.json` to `public/canal-drive/models/covers.json` →
`npm run check:covers`; `npm run check:osm-under-models`; `npm run check:canal`;
`npm run census -- --write`; one HISTORY line with the day's counts.

## Acceptance

A batch is done when every row has a status other than `compiled`, the census
headline moved by the number of `installed` rows, and `kit-gaps.md` lists what
the kit could not say.
